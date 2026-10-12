#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Certbot entrypoint — issues and renews Let's Encrypt certificates.
#
# Behavior:
#   1. If a certificate already exists for $DOMAINS, run certbot in renew-loop
#      mode (checks every 12h, renews when < 30 days remain).
#   2. If no certificate exists, attempt initial issuance via the webroot
#      challenge (requires the nginx container to already be serving
#      /.well-known/acme-challenge/ from the shared webroot volume).
#
# Mounted into the certbot container at /entrypoint.sh.
# Volumes:
#   /etc/letsencrypt   — persistent certificates (shared with nginx, read-only)
#   /var/www/certbot   — ACME webroot (shared with nginx)
# ─────────────────────────────────────────────────────────────────────────────
set -eu

DOMAINS="${DOMAINS:-}"
EMAIL="${EMAIL:-}"
WEBROOT="/var/www/certbot"
RENEW_INTERVAL="${RENEW_INTERVAL:-12h}"
RSA_KEY_SIZE="${RSA_KEY_SIZE:-2048}"

# Parse comma-separated domains into -d flags.
domain_args=""
primary_domain=""
if [ -n "$DOMAINS" ]; then
  primary_domain="$(printf '%s' "$DOMAINS" | cut -d',' -f1 | tr -d ' ')"
  for d in $(printf '%s' "$DOMAINS" | tr ',' ' '); do
    domain_args="$domain_args -d $d"
  done
fi

echo "[certbot] domains: ${DOMAINS:-<none>}"
echo "[certbot] primary: ${primary_domain:-<none>}"
echo "[certbot] email: ${EMAIL:-<none>}"

if [ -z "$primary_domain" ]; then
  echo "[certbot] DOMAINS not set — running renewal loop only (certs managed externally)."
  while true; do
    certbot renew --quiet || true
    sleep "$RENEW_INTERVAL"
  done
  exit 0
fi

cert_path="/etc/letsencrypt/live/$primary_domain/fullchain.pem"

# Initial issuance if no cert exists yet.
if [ ! -f "$cert_path" ]; then
  echo "[certbot] No certificate found for $primary_domain — requesting initial issuance."

  if [ -z "$EMAIL" ]; then
    email_arg="--register-unsafely-without-email"
  else
    email_arg="--email $EMAIL --no-eff-email"
  fi

  # shellcheck disable=SC2086
  certbot certonly --webroot \
    -w "$WEBROOT" \
    $domain_args \
    $email_arg \
    --agree-tos \
    --non-interactive \
    --key-type rsa \
    --rsa-key-size "$RSA_KEY_SIZE" \
    --keep-until-expiring

  echo "[certbot] Certificate issued successfully."
else
  echo "[certbot] Certificate already exists at $cert_path."
fi

# Reload nginx so it picks up the new cert (via the shared SIGHUP).
# The nginx container shares the /etc/letsencrypt volume, so a reload is enough.
echo "[certbot] Signaling nginx to reload certificates..."
if command -v nginx >/dev/null 2>&1; then
  nginx -s reload 2>/dev/null || true
fi
# Alternative: docker compose can trigger reload via the compose socket, but the
# certbot container doesn't have the docker CLI. We rely on the renew-loop below
# plus the nginx container's own cert refresh handling.

echo "[certbot] Entering renewal loop (checking every $RENEW_INTERVAL)..."
while true; do
  certbot renew --quiet --deploy-hook "touch /var/www/certbot/.reload-nginx" || true
  sleep "$RENEW_INTERVAL"
done
