#!/bin/sh
set -eu

database_path="${DATABASE_URL#file:}"
case "$database_path" in
  /*) ;;
  *) database_path="/app/$database_path" ;;
esac

mkdir -p "$(dirname "$database_path")" /app/logs

# init.sql is deliberately idempotent: it creates missing tables/indexes while
# keeping every existing row. Then apply tiny forward migrations for volumes
# created by older releases whose Upload table predates media metadata.
sqlite3 "$database_path" < /app/prisma/init.sql

has_upload_column() {
  sqlite3 "$database_path" "PRAGMA table_info('Upload');" | awk -F'|' -v name="$1" '$2 == name { found=1 } END { exit found ? 0 : 1 }'
}

has_upload_column title || sqlite3 "$database_path" "ALTER TABLE \"Upload\" ADD COLUMN \"title\" TEXT NOT NULL DEFAULT '';"
has_upload_column altText || sqlite3 "$database_path" "ALTER TABLE \"Upload\" ADD COLUMN \"altText\" TEXT NOT NULL DEFAULT '';"
has_upload_column category || sqlite3 "$database_path" "ALTER TABLE \"Upload\" ADD COLUMN \"category\" TEXT NOT NULL DEFAULT 'Uncategorized';"
has_upload_column tags || sqlite3 "$database_path" "ALTER TABLE \"Upload\" ADD COLUMN \"tags\" TEXT NOT NULL DEFAULT '[]';"

# ─────────────────────────────────────────────────────────────────────────────
# Zero-config first boot.
#
# The published (clean) image ships with NO secrets baked in. The app requires
# AUTH_SECRET in production, so generate one for the lifetime of the container
# when it is not provided. If no CMS admin credential is provided either, fall
# back to the documented default shipped in prisma/default-admin-password.txt
# and drop a CMS-PASSWORD.txt notice next to the database so the operator
# cannot miss it. Explicit AUTH_SECRET / ADMIN_PASSWORD env vars always win.
# ─────────────────────────────────────────────────────────────────────────────
if [ -z "${AUTH_SECRET:-}" ]; then
  boot_nonce="$(openssl rand -hex 32 2>/dev/null || node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
  export AUTH_SECRET="${boot_nonce}"
  echo "[p00rija] AUTH_SECRET was not set — generated a session nonce for this container."
fi

default_credential_file="/app/prisma/default-admin-password.txt"
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  if [ -f "$default_credential_file" ]; then
    boot_credential="$(head -n 1 "$default_credential_file" | tr -d '[:space:]')"
  else
    # Fallback of last resort: a random value surfaced via the notice file.
    boot_credential="$(node -e "process.stdout.write(require('crypto').randomBytes(9).toString('base64url'))")"
  fi
  export ADMIN_PASSWORD="${boot_credential}"
  notice_file="$(dirname "$database_path")/CMS-PASSWORD.txt"
  if [ ! -f "$notice_file" ]; then
    {
      printf '⚠️  FIRST-BOOT CMS LOGIN — CHANGE IT NOW ⚠️\n'
      printf '============================================\n\n'
      printf 'Generated at: %s\n' "$(date -u '+%Y-%m-%d %H:%M UTC')"
      printf 'CMS login value: %s\n\n' "$ADMIN_PASSWORD"
      printf 'This value exists so the container can boot with zero config.\n'
      printf 'If it is the documented public default, ANYONE can log into the CMS\n'
      printf 'until you change it.\n\n'
      printf 'Change it in one of these ways (ideally BOTH):\n'
      printf '  1. Log into the CMS and set a new login value (CMS settings), or\n'
      printf '  2. Restart the container with a strong value:\n'
      printf '       -e ADMIN_PASSWORD="your-strong-value"\n\n'
      printf 'This file is only a first-boot notice; deleting it does NOT change anything.\n'
    } > "$notice_file"
  fi
  echo "[p00rija] ⚠ ADMIN_PASSWORD not set — using the documented default (see CMS-PASSWORD.txt in the db volume)."
  echo "[p00rija] ⚠ CHANGE IT IMMEDIATELY (CMS settings, or -e ADMIN_PASSWORD=...)."
fi

exec node server.js
