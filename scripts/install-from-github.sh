#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY_URL="https://github.com/Poorija/P00RIJA-PORTFOLIO.git"
INSTALL_DIR="${P00RIJA_INSTALL_DIR:-/opt/p00rija-portfolio}"

if [ "$(id -u)" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

install_git() {
  command -v git >/dev/null 2>&1 && return 0
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y git ca-certificates curl
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y git ca-certificates curl
  elif command -v yum >/dev/null 2>&1; then
    yum install -y git ca-certificates curl
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache git ca-certificates curl
  else
    echo "Unsupported package manager. Install git, curl and CA certificates first." >&2
    exit 1
  fi
}

install_git
if [ -e "$INSTALL_DIR" ] && [ ! -d "$INSTALL_DIR/.git" ]; then
  echo "Refusing to overwrite existing non-Git path: $INSTALL_DIR" >&2
  exit 1
fi
if [ ! -d "$INSTALL_DIR/.git" ]; then
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --depth 1 "$REPOSITORY_URL" "$INSTALL_DIR"
else
  git -C "$INSTALL_DIR" pull --ff-only
fi

cd "$INSTALL_DIR"
export P00RIJA_DISTRIBUTION_MODE="${P00RIJA_DISTRIBUTION_MODE:-null}"
export P00RIJA_ADMIN_PASSWORD="${P00RIJA_ADMIN_PASSWORD:-admin123}"

if [ -n "${P00RIJA_DOMAIN:-}" ]; then
  exec bash install.sh --web-auto
fi
exec bash install.sh --docker
