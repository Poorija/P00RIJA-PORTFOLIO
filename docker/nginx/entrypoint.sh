#!/bin/sh
set -eu

# Certbot writes marker after renewal. Reload keeps active connections alive and
# avoids exposing Docker socket or host privileges to either container.
(
  while sleep "${CERT_RELOAD_INTERVAL:-300}"; do
    if [ -f /var/www/certbot/.reload-nginx ]; then
      nginx -s reload 2>/dev/null || true
      rm -f /var/www/certbot/.reload-nginx
    fi
  done
) &

exec nginx -g 'daemon off;'
