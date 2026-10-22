#!/usr/bin/env bash
# ============================================================================
# deploy-image.sh — ship the locally-built production image to the server.
#
# The production server is tiny (1 CPU / 512MB): it must NEVER build. This
# script pushes a prebuilt image archive, loads it, and restarts the compose
# stack with --no-build. The server's own database volume is untouched.
#
# Usage:
#   bash scripts/deploy-image.sh [user@host] [ssh-port]
#
# Environment overrides:
#   P00RIJA_DEPLOY_HOST    user@host              (or pass as arg 1)
#   P00RIJA_SSH_PORT       ssh port               (or pass as arg 2, default 22)
#   P00RIJA_DEPLOY_DIR     remote checkout dir    (default /opt/p00rija-portfolio)
#   P00RIJA_IMAGE_TAR      local image archive    (default newest dist/*-image-v*.tar.gz)
#   P00RIJA_IMAGE_REF      image reference inside the archive
#                                                 (default p00rija/portfolio:latest)
#   P00RIJA_COMPOSE_FILE   remote compose file    (default: auto-detect
#                          docker-compose.web.yml, then docker-compose.server.yml)
# ============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
note() { printf '• %s\n' "$*"; }
die() { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

TARGET="${1:-${P00RIJA_DEPLOY_HOST:-}}"
SSH_PORT="${2:-${P00RIJA_SSH_PORT:-22}}"
DEPLOY_DIR="${P00RIJA_DEPLOY_DIR:-/opt/p00rija-portfolio}"
IMAGE_REF="${P00RIJA_IMAGE_REF:-p00rija/portfolio:latest}"

if [ -z "$TARGET" ]; then
  read -r -p "Deploy target (user@host): " TARGET
fi
[ -n "$TARGET" ] || die "No deploy target given."

IMAGE_TAR="${P00RIJA_IMAGE_TAR:-}"
if [ -z "$IMAGE_TAR" ]; then
  IMAGE_TAR="$(ls -t dist/p00rija-portfolio-image-v*.tar.gz 2>/dev/null | head -n1 || true)"
fi
[ -n "$IMAGE_TAR" ] && [ -f "$IMAGE_TAR" ] || die "No image archive found. Run: bash scripts/make-clean-package.sh --image"

VERSION="$(sed -n 's/^export const APP_VERSION = "\(.*\)";/\1/p' src/lib/app-version.ts | head -n1)"

note "Target      : $TARGET:$SSH_PORT"
note "Remote dir  : $DEPLOY_DIR"
note "Image archive: $IMAGE_TAR ($(du -h "$IMAGE_TAR" | cut -f1))"

echo
bold "This will restart the app container on $TARGET (a few seconds of downtime)."
read -r -p "Continue? [y/N]: " answer
case "$answer" in y|Y|yes|YES) ;; *) die "Aborted." ;; esac

note "Transferring image archive..."
scp -P "$SSH_PORT" "$IMAGE_TAR" "$TARGET:/tmp/p00rija-deploy-image.tar.gz"

note "Loading image and restarting the stack (remote)..."
# Piped through `bash -s` so the remote default shell (fish, …) never
# interprets the script, and unquoted heredoc so local vars expand.
ssh -p "$SSH_PORT" "$TARGET" bash -s <<REMOTE_SCRIPT
set -eu
# Non-root deploy users (e.g. pooriya) reach docker through passwordless sudo.
if docker info >/dev/null 2>&1; then DOCKER="docker"; else DOCKER="sudo docker"; fi
echo "• docker command: \$DOCKER"
echo '• Checking server platform vs image...'
server_arch=\$(uname -m)
case "\$server_arch" in
  x86_64) want=amd64 ;;
  aarch64|arm64) want=arm64 ;;
  *) want="\$server_arch" ;;
esac
echo "  server arch: \$server_arch (need linux/\$want)"
echo '• Loading image...'
\$DOCKER load -i /tmp/p00rija-deploy-image.tar.gz
loaded_arch=\$(\$DOCKER image inspect $IMAGE_REF --format '{{.Architecture}}')
if [ "\$loaded_arch" != "\$want" ]; then
  echo "ERROR: image architecture linux/\$loaded_arch does NOT match server linux/\$want — refusing to restart." >&2
  echo "Build with: docker build --platform linux/\$want ..." >&2
  \$DOCKER rmi "$IMAGE_REF" >/dev/null 2>&1 || true
  exit 1
fi
\$DOCKER tag $IMAGE_REF p00rija/portfolio:local
rm -f /tmp/p00rija-deploy-image.tar.gz

cd '$DEPLOY_DIR'
COMPOSE_FILE='${P00RIJA_COMPOSE_FILE:-}'
if [ -z "\$COMPOSE_FILE" ]; then
  if [ -f docker-compose.web.yml ]; then COMPOSE_FILE=docker-compose.web.yml
  elif [ -f docker-compose.server.yml ]; then COMPOSE_FILE=docker-compose.server.yml
  else echo "ERROR: no compose file in $DEPLOY_DIR" >&2; exit 1; fi
fi
echo "• Restarting with \$COMPOSE_FILE (--no-build — the server never builds)..."
# A docker-compose.override.yml next to the main file carries machine-specific
# service tweaks (e.g. extra_hosts host-gateway for the license heartbeat) —
# it MUST be included, or a recreate silently drops those settings.
OVERRIDE_FLAG=""
if [ -f docker-compose.override.yml ]; then
  OVERRIDE_FLAG="-f docker-compose.override.yml"
  echo "  (including docker-compose.override.yml)"
fi
\$DOCKER compose -f "\$COMPOSE_FILE" \$OVERRIDE_FLAG up -d --no-build app || \$DOCKER compose -f "\$COMPOSE_FILE" \$OVERRIDE_FLAG up -d --no-build
echo '• Waiting for the container health check...'
ok=0
for i in \$(seq 1 45); do
  status=\$(\$DOCKER inspect --format='{{.State.Health.Status}}' p00rija-portfolio-web-app 2>/dev/null || \$DOCKER inspect --format='{{.State.Health.Status}}' p00rija-portfolio 2>/dev/null || echo unknown)
  if [ "\$status" = healthy ]; then ok=1; break; fi
  sleep 2
done
if [ "\$ok" = 1 ]; then
  echo '✅ App container is healthy.'
else
  echo 'WARNING: health check did not pass within 90s — check: sudo docker logs p00rija-portfolio-web-app' >&2
  exit 1
fi
# Reclaim space from the superseded image layers.
\$DOCKER image prune -f >/dev/null 2>&1 || true
REMOTE_SCRIPT

echo
bold "Deployed v$VERSION → $TARGET"
note "Verify the version in the site footer / CMS status bar / console banner (expect v$VERSION)."
