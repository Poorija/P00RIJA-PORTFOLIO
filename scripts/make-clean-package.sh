#!/usr/bin/env bash
# ============================================================================
# make-clean-package.sh — build the distribution artifacts:
#
#   1. A CLEAN source package (GitHub): the app source only — no .env, no
#      database, no uploads, no node_modules/build output, no local junk.
#      Ships with .env.example, DEFAULT-CMS-PASSWORD.txt (must-change notice)
#      and the interactive installer (which asks for the CMS login on install).
#
#   2. Optionally (--image): a CLEAN production Docker image built from that
#      package directory (so no secret can leak into any layer), plus a
#      `docker save` archive ready for `docker load` anywhere or pushing
#      to Docker Hub.
#
# Usage:
#   bash scripts/make-clean-package.sh           # source package only
#   bash scripts/make-clean-package.sh --image   # package + image + tar
#   bash scripts/make-clean-package.sh --no-archive   # just stage the tree
# ============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

BUILD_IMAGE=0
MAKE_ARCHIVE=1
for arg in "$@"; do
  case "$arg" in
    --image) BUILD_IMAGE=1 ;;
    --no-archive) MAKE_ARCHIVE=0 ;;
    *) echo "Unknown option: $arg (use --image, --no-archive)" >&2; exit 1 ;;
  esac
done

APP_NAME="p00rija-portfolio"
VERSION="$(sed -n 's/^export const APP_VERSION = "\(.*\)";/\1/p' src/lib/app-version.ts | head -n1)"
[ -n "$VERSION" ] || { echo "ERROR: could not read APP_VERSION from src/lib/app-version.ts" >&2; exit 1; }

DIST="$SCRIPT_DIR/dist"
STAGE="$DIST/$APP_NAME-clean-v$VERSION"

note() { printf '• %s\n' "$*"; }

# ── 1. Stage the clean source tree ──────────────────────────────────────────
rm -rf "$STAGE"
mkdir -p "$STAGE"

# tar-based copy (universal on macOS/Linux). Trailing '/' patterns anchor to
# the repo root only; unanchored patterns exclude at every depth.
tar -cf - \
  --exclude './.git' \
  --exclude './node_modules' \
  --exclude './.next' \
  --exclude './dist' \
  --exclude './db' \
  --exclude './prisma/*.db' \
  --exclude './.env' \
  --exclude './.env.local' \
  --exclude './.env.*.local' \
  --exclude '.DS_Store' \
  --exclude './.playwright-mcp' \
  --exclude './.mimosa' \
  --exclude './agent-ctx' \
  --exclude './download' \
  --exclude './examples' \
  --exclude './mini-services' \
  --exclude './tool-results' \
  --exclude './docker-compose.web.yml' \
  --exclude './docker-compose.server.yml' \
  --exclude './bun.lock' \
  --exclude './Caddyfile' \
  --exclude './AGENTS.md' \
  --exclude './CLAUDE.md' \
  --exclude './*.log' \
  --exclude './--port' \
  --exclude './7891' \
  --exclude './band-*.png' \
  --exclude './entry-*.png' \
  --exclude './guard-*.png' \
  --exclude './gate-*.png' \
  --exclude './live-*.png' \
  --exclude './tsconfig.tsbuildinfo' \
  --exclude './license-server' \
  --exclude './docker-compose.license.yml' \
  --exclude './docker-compose.license.local.yml' \
  --exclude './Dockerfile.license' \
  . | tar -xf - -C "$STAGE"

# ── 2. Distribution metadata files ──────────────────────────────────────────
if [ ! -f "$STAGE/.env.example" ]; then
  echo "ERROR: .env.example missing after staging" >&2
  exit 1
fi

cat > "$STAGE/DEFAULT-CMS-PASSWORD.txt" <<NOTICE
⚠️  DEFAULT CMS PASSWORD — CHANGE IT AFTER FIRST LOGIN ⚠️
=========================================================

The default CMS admin password in this package is:

    admin123

This is a PUBLIC, DOCUMENTED DEFAULT — it exists only so the app can boot
with zero configuration. Anyone who finds your site can log into the CMS
with it until you change it. The CMS controls ALL site content.

Change it in one of these ways (ideally BOTH):

  1. Interactive installer (install.sh): it ASKS you for a CMS password
     during installation — enter a strong value when prompted.

  2. Docker/compose: start the container with a strong value:

       docker run -e ADMIN_PASSWORD="your-strong-password" ...
       # or uncomment ADMIN_PASSWORD in docker-compose.hub.yml

  3. After first login: set a new password from the CMS settings screen.

Reference: .env.example (ADMIN_PASSWORD), scripts/container-entrypoint.sh
(first-boot notice file CMS-PASSWORD.txt is written into the db volume).
NOTICE

# ── 3. Secret sanity checks — the package must be clean ─────────────────────
if [ -e "$STAGE/.env" ]; then
  echo "ERROR: .env leaked into the package" >&2; exit 1
fi
if [ -d "$STAGE/db" ]; then
  echo "ERROR: db/ leaked into the package" >&2; exit 1
fi
if [ -d "$STAGE/license-server" ] || [ -f "$STAGE/Dockerfile.license" ]; then
  echo "ERROR: the private license-server leaked into the public package" >&2; exit 1
fi
# Assembled at runtime so this script never contains the literal itself.
local_pw_marker="P00RIJA-local-""2026"
if grep -R -l "$local_pw_marker" "$STAGE" 2>/dev/null | grep -v node_modules >/dev/null 2>&1; then
  echo "ERROR: the local development password leaked into the package:" >&2
  grep -R -l "$local_pw_marker" "$STAGE" 2>/dev/null | head -5 >&2
  exit 1
fi
found_secret="$(grep -R -l '^AUTH_SECRET=.\+' "$STAGE" --include='.env*' 2>/dev/null | grep -v '.env.example' || true)"
if [ -n "$found_secret" ]; then
  echo "ERROR: a populated AUTH_SECRET leaked into the package: $found_secret" >&2
  exit 1
fi
note "Sanity checks passed: no .env, no db/, no local secrets in the staged tree."

# ── 4. Archives ─────────────────────────────────────────────────────────────
if [ "$MAKE_ARCHIVE" = "1" ]; then
  tar -czf "$DIST/$APP_NAME-clean-v$VERSION.tar.gz" -C "$DIST" "$APP_NAME-clean-v$VERSION"
  note "Source archive: dist/$APP_NAME-clean-v$VERSION.tar.gz"
  if command -v zip >/dev/null 2>&1; then
    ( cd "$DIST" && rm -f "$APP_NAME-clean-v$VERSION.zip" && zip -qr "$APP_NAME-clean-v$VERSION.zip" "$APP_NAME-clean-v$VERSION" )
    note "Source archive: dist/$APP_NAME-clean-v$VERSION.zip"
  fi
fi

# ── 5. Clean production image (optional) ────────────────────────────────────
if [ "$BUILD_IMAGE" = "1" ]; then
  command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found" >&2; exit 1; }
  # The production VPS is linux/amd64; Apple-Silicon Macs default to arm64.
  # Always cross-build explicitly so the artifact matches the target server.
  TARGET_PLATFORM="${P00RIJA_IMAGE_PLATFORM:-linux/amd64}"
  note "Building the clean production image (${TARGET_PLATFORM}) from the staged tree (no secrets in context)..."
  docker build \
    --platform "$TARGET_PLATFORM" \
    -t "p00rija/portfolio:v$VERSION" \
    -t "p00rija/portfolio:latest" \
    -t "p00rija/portfolio:local" \
    -f "$STAGE/Dockerfile" "$STAGE"

  if [ "$MAKE_ARCHIVE" = "1" ]; then
    note "Exporting docker save archive (this can take a minute)..."
    docker save "p00rija/portfolio:v$VERSION" | gzip > "$DIST/$APP_NAME-image-v$VERSION.tar.gz"
    note "Image archive: dist/$APP_NAME-image-v$VERSION.tar.gz"
    note "Load anywhere with:  docker load -i $APP_NAME-image-v$VERSION.tar.gz"
    note "Push to Docker Hub:  docker push p00rija/portfolio:v$VERSION && docker push p00rija/portfolio:latest"
  fi
fi

note "Done — clean package for v$VERSION ready in dist/"
