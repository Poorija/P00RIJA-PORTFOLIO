#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

MODE="${MODE:-dev}"
if [ -n "${PORT:-}" ]; then
  PORT_EXPLICIT=1
else
  PORT="3000"
  PORT_EXPLICIT=0
fi
HOSTNAME="${HOSTNAME:-0.0.0.0}"
DB_FILE="${DB_FILE:-$SCRIPT_DIR/db/custom.db}"
LOG_FILE="${LOG_FILE:-}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
HIDE_DEV_INDICATOR="${HIDE_DEV_INDICATOR:-0}"

usage() {
  cat <<'USAGE'
Usage:
  ./run.sh [--dev|--prod] [--port PORT] [--host HOST] [--db FILE] [--log FILE] [--no-install] [--no-build] [--hide-dev-indicator]

Examples:
  ./run.sh
  ./run.sh --port 3005
  ./run.sh --prod --port 8080 --host 0.0.0.0
  PORT=8080 MODE=prod ./run.sh

Options:
  --dev              Run Next.js dev server (default).
  --prod, --server   Build and run the standalone production server.
  --port, -p PORT    Port to listen on. When explicit, this exact port is required.
  --host, -H HOST    Host/interface to bind. Default: 0.0.0.0
  --db FILE          SQLite database file. Default: ./db/custom.db
  --log FILE         Log file. Default: dev.log or server.log based on mode.
  --no-install       Skip dependency install step.
  --no-build         In production mode, skip build and use the existing .next/standalone bundle.
  --hide-dev-indicator
                     Hide the Next.js dev/debug indicator in dev mode.
  --help, -h         Show this help.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dev)
      MODE="dev"
      shift
      ;;
    --prod|--production|--server)
      MODE="prod"
      shift
      ;;
    --port|-p)
      [ "${2:-}" ] || { echo "ERROR: --port requires a value." >&2; exit 1; }
      PORT="$2"
      PORT_EXPLICIT=1
      shift 2
      ;;
    --host|-H|--hostname)
      [ "${2:-}" ] || { echo "ERROR: --host requires a value." >&2; exit 1; }
      HOSTNAME="$2"
      shift 2
      ;;
    --db|--database)
      [ "${2:-}" ] || { echo "ERROR: --db requires a value." >&2; exit 1; }
      DB_FILE="$2"
      shift 2
      ;;
    --log)
      [ "${2:-}" ] || { echo "ERROR: --log requires a value." >&2; exit 1; }
      LOG_FILE="$2"
      shift 2
      ;;
    --no-install)
      SKIP_INSTALL=1
      shift
      ;;
    --no-build)
      SKIP_BUILD=1
      shift
      ;;
    --hide-dev-indicator|--hide-debug-icon)
      HIDE_DEV_INDICATOR=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    [0-9]*)
      PORT="$1"
      PORT_EXPLICIT=1
      shift
      ;;
    *)
      echo "ERROR: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$MODE" in
  dev|development) MODE="dev" ;;
  prod|production|server) MODE="prod" ;;
  *) echo "ERROR: MODE must be dev or prod, got '$MODE'." >&2; exit 1 ;;
esac

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "ERROR: port must be a number between 1 and 65535." >&2
  exit 1
fi

if [ -z "$LOG_FILE" ]; then
  if [ "$MODE" = "prod" ]; then
    LOG_FILE="$SCRIPT_DIR/server.log"
  else
    LOG_FILE="$SCRIPT_DIR/dev.log"
  fi
fi

mkdir -p "$(dirname "$DB_FILE")"
mkdir -p "$(dirname "$LOG_FILE")"

export DATABASE_URL="file:$DB_FILE"
export AUTH_SECRET="${AUTH_SECRET:-portfolio-cms-secret-key-2025-very-long}"
export NEXT_TELEMETRY_DISABLED=1
if [ "$HIDE_DEV_INDICATOR" = "1" ]; then
  export HIDE_NEXT_DEV_INDICATOR=1
fi

if command -v bun >/dev/null 2>&1; then
  PACKAGE_MANAGER="bun"
  INSTALL_CMD=(bun install)
  PRISMA_CMD=(bunx prisma)
elif command -v npm >/dev/null 2>&1; then
  PACKAGE_MANAGER="npm"
  INSTALL_CMD=(npm install --no-audit --no-fund)
  PRISMA_CMD=(npx prisma)
else
  echo "ERROR: neither bun nor npm was found in PATH."
  echo "Install Node.js/npm or Bun, then run this script again."
  exit 1
fi

echo "Project: $SCRIPT_DIR"
echo "Package manager: $PACKAGE_MANAGER"
echo "Mode: $MODE"
echo "Database: $DB_FILE"

if [ "$SKIP_INSTALL" = "1" ]; then
  echo "Skipping dependency install."
elif [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "Installing dependencies..."
  "${INSTALL_CMD[@]}"
else
  echo "Dependencies already installed; skipping install."
fi

echo "Generating Prisma client..."
"${PRISMA_CMD[@]}" generate

echo "Syncing SQLite database schema..."
"${PRISMA_CMD[@]}" db push

NEXT_BIN="$SCRIPT_DIR/node_modules/.bin/next"
if [ ! -x "$NEXT_BIN" ]; then
  echo "ERROR: Next.js binary was not found at $NEXT_BIN"
  echo "Try deleting node_modules and running this script again."
  exit 1
fi

is_port_busy() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  if command -v nc >/dev/null 2>&1; then
    nc -z localhost "$port" >/dev/null 2>&1
    return $?
  fi

  return 1
}

REQUESTED_PORT="$PORT"
while is_port_busy "$PORT"; do
  if [ "$PORT_EXPLICIT" = "1" ]; then
    echo "ERROR: requested port $PORT is already in use." >&2
    echo "Stop the process using it or choose another port with --port." >&2
    exit 1
  fi
  PORT=$((PORT + 1))
done

if [ "$PORT" != "$REQUESTED_PORT" ]; then
  echo "Port $REQUESTED_PORT is already in use; using port $PORT instead."
fi

if [ "$MODE" = "prod" ] && [ "$SKIP_BUILD" != "1" ]; then
  echo "Building production bundle..."
  if [ "$PACKAGE_MANAGER" = "bun" ]; then
    sh scripts/hardware-profile.sh build bun run build
  else
    sh scripts/hardware-profile.sh build npm run build
  fi
elif [ "$MODE" = "prod" ]; then
  echo "Skipping production build; using existing standalone bundle."
fi

echo "Starting portfolio on http://$HOSTNAME:$PORT"
echo "Log file: $LOG_FILE"
echo "Press Ctrl+C to stop."

if [ "$MODE" = "prod" ]; then
  STANDALONE_SERVER="$SCRIPT_DIR/.next/standalone/server.js"
  if [ ! -f "$STANDALONE_SERVER" ]; then
    echo "ERROR: standalone server was not found at $STANDALONE_SERVER" >&2
    echo "Make sure next.config.* enables output: 'standalone'." >&2
    exit 1
  fi
  PORT="$PORT" HOSTNAME="$HOSTNAME" NODE_ENV=production sh scripts/hardware-profile.sh run node "$STANDALONE_SERVER" 2>&1 | tee "$LOG_FILE"
else
  "$NEXT_BIN" dev -H "$HOSTNAME" -p "$PORT" 2>&1 | tee "$LOG_FILE"
fi
