#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
ask() { local prompt="$1" default="${2:-}" answer; read -r -p "$prompt${default:+ [$default]}: " answer; printf '%s' "${answer:-$default}"; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing prerequisite: $1"; }
valid_port() { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; }
quote_sh() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\"'\\\"'/g")"; }

for tool in ssh scp tar mktemp; do need "$tool"; done

ssh_cmd=(ssh)
scp_cmd=(scp)
if [ -n "${P00RIJA_SSH_PASSWORD:-}" ]; then
  need sshpass
  export SSHPASS="$P00RIJA_SSH_PASSWORD"
  ssh_cmd=(sshpass -e ssh)
  scp_cmd=(sshpass -e scp)
fi

target_host="${P00RIJA_TARGET_HOST:-$(ask "Target server IP/domain")}" 
target_user="${P00RIJA_TARGET_USER:-$(ask "SSH user" "root")}" 
ssh_port="${P00RIJA_SSH_PORT:-$(ask "SSH port" "22")}" 
domain="${P00RIJA_DOMAIN:-$(ask "Public domain or IP" "$target_host")}" 
public_port="${P00RIJA_PUBLIC_PORT:-$(ask "HTTPS port" "443")}" 
ssl_mode="${P00RIJA_SSL_MODE:-$(ask "SSL mode (le/self-signed/existing)" "le")}" 
le_email="${P00RIJA_LE_EMAIL:-}"
backup_path="${P00RIJA_BACKUP_PATH:-$(ask "Backup file path (optional)" "")}" 
transfer_mode="${P00RIJA_TRANSFER_MODE:-auto}"

valid_port "$ssh_port" || die "Invalid SSH port"
valid_port "$public_port" || die "Invalid HTTPS port"
case "$ssl_mode" in le|self-signed) ;; *) die "Migration supports le or self-signed. Use install.sh --web for existing certificate files." ;; esac
if [ "$ssl_mode" = "le" ] && [ -z "$le_email" ]; then le_email="$(ask "Let's Encrypt email" "admin@$domain")"; fi
[ -z "$backup_path" ] || [ -f "$backup_path" ] || die "Backup not found: $backup_path"
case "$transfer_mode" in auto|prebuilt|source) ;; *) die "P00RIJA_TRANSFER_MODE must be auto, prebuilt, or source" ;; esac

target="$target_user@$target_host"

# OpenSSH passes a remote command through the account's login shell. Wrapping
# every payload in `sh -c` keeps migration compatible with fish, csh, zsh, and
# other non-POSIX login shells while preserving an interactive TTY for sudo.
remote_sh() {
  local payload="$1"
  "${ssh_cmd[@]}" -tt -p "$ssh_port" "$target" "sh -c $(quote_sh "$payload")"
}

printf 'Checking SSH and sudo/root access. Password prompts stay inside SSH; nothing is stored.\n'
remote_sh 'set -e; if [ "$(id -u)" -ne 0 ]; then command -v sudo >/dev/null; sudo -v; fi; command -v tar >/dev/null; echo "Remote access OK"'

remote_profile="$("${ssh_cmd[@]}" -p "$ssh_port" "$target" "sh -c 'memory_mb=\$(awk '\''/MemTotal:/ { printf \"%d\", \$2 / 1024; exit }'\'' /proc/meminfo); cpu_count=\$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1); arch=\$(uname -m); printf \"%s|%s|%s\" \"\$memory_mb\" \"\$cpu_count\" \"\$arch\"'" | tr -d '\r')"
IFS='|' read -r remote_memory_mb remote_cpu_count remote_arch <<<"$remote_profile"
case "$remote_arch" in x86_64|amd64) image_platform=amd64 ;; aarch64|arm64) image_platform=arm64 ;; *) image_platform="" ;; esac

use_prebuilt=0
if [ "$transfer_mode" = "prebuilt" ]; then
  use_prebuilt=1
elif [ "$transfer_mode" = "auto" ] && { [ "${remote_memory_mb:-0}" -le 1536 ] || [ "${remote_cpu_count:-0}" -le 1 ]; }; then
  use_prebuilt=1
fi
if [ "$use_prebuilt" -eq 1 ]; then
  [ -n "$image_platform" ] || die "Unsupported remote CPU architecture for prebuild: $remote_arch"
  need docker
  docker buildx version >/dev/null 2>&1 || die "Docker Buildx is required for low-resource prebuilt migration"
fi

temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT
bundle="$temporary_dir/p00rija-portfolio.tar.gz"

COPYFILE_DISABLE=1 tar \
  --exclude='.git' --exclude='.next' --exclude='node_modules' --exclude='.env' \
  --exclude='db/*.db*' --exclude='*.log' --exclude='docker-compose.web.yml' \
  -czf "$bundle" .

remote_bundle="/tmp/p00rija-portfolio-$$.tar.gz"
"${scp_cmd[@]}" -P "$ssh_port" "$bundle" "$target:$remote_bundle"
remote_image=""
prebuilt_image_ref=""
if [ "$use_prebuilt" -eq 1 ]; then
  prebuilt_image_ref="p00rija/portfolio:migration-$image_platform"
  prebuilt_archive="$temporary_dir/p00rija-portfolio-$image_platform.tar.gz"
  printf 'Low-resource target detected (%s CPU / %s MB). Prebuilding linux/%s locally...\n' "$remote_cpu_count" "$remote_memory_mb" "$image_platform"
  BUILDKIT_PROGRESS=plain docker buildx build --platform "linux/$image_platform" --load \
    --build-arg P00RIJA_BUILD_MEMORY_MB=2048 --build-arg P00RIJA_BUILD_CPUS=2 \
    -t "$prebuilt_image_ref" -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"
  docker save "$prebuilt_image_ref" | gzip -1 > "$prebuilt_archive"
  remote_image="/tmp/p00rija-image-$$.tar.gz"
  "${scp_cmd[@]}" -P "$ssh_port" "$prebuilt_archive" "$target:$remote_image"
fi
remote_backup=""
if [ -n "$backup_path" ]; then
  remote_backup="/tmp/p00rija-restore-$$.p00backup.gz"
  "${scp_cmd[@]}" -P "$ssh_port" "$backup_path" "$target:$remote_backup"
fi

quoted_email="$(quote_sh "$le_email")"
quoted_domain="$(quote_sh "$domain")"
quoted_mode="$(quote_sh "$ssl_mode")"
quoted_public_port="$(quote_sh "$public_port")"
quoted_remote_bundle="$(quote_sh "$remote_bundle")"
quoted_remote_image="$(quote_sh "$remote_image")"
quoted_prebuilt_image_ref="$(quote_sh "$prebuilt_image_ref")"

remote_sh "\
  set -e; \
  SUDO=''; [ \"\$(id -u)\" -eq 0 ] || SUDO=sudo; \
  \$SUDO mkdir -p /opt/p00rija-portfolio; \
  \$SUDO chmod 755 /opt/p00rija-portfolio; \
  \$SUDO tar --no-same-owner --no-same-permissions -xzf $quoted_remote_bundle -C /opt/p00rija-portfolio; \
  \$SUDO chown -R root:root /opt/p00rija-portfolio; \
  \$SUDO chmod 755 /opt/p00rija-portfolio; \
  cd /opt/p00rija-portfolio; \
  \$SUDO env P00RIJA_DOMAIN=$quoted_domain P00RIJA_PUBLIC_PORT=$quoted_public_port P00RIJA_SSL_MODE=$quoted_mode P00RIJA_LE_EMAIL=$quoted_email P00RIJA_PREBUILT_IMAGE_PATH=$quoted_remote_image P00RIJA_PREBUILT_IMAGE_REF=$quoted_prebuilt_image_ref bash install.sh --web-auto; \
  rm -f $quoted_remote_bundle"

if [ -n "$remote_backup" ]; then
  quoted_remote_backup="$(quote_sh "$remote_backup")"
  remote_sh "\
    set -e; cd /opt/p00rija-portfolio; \
    SUDO=''; [ \"\$(id -u)\" -eq 0 ] || SUDO=sudo; \
    \$SUDO docker compose -f docker-compose.web.yml cp $quoted_remote_backup app:/tmp/restore.p00backup.gz; \
    \$SUDO docker compose -f docker-compose.web.yml exec -T app node scripts/restore-backup.mjs /tmp/restore.p00backup.gz; \
    \$SUDO docker compose -f docker-compose.web.yml restart app; \
    rm -f $quoted_remote_backup"
fi

if [ "$public_port" = "443" ]; then url="https://$domain"; else url="https://$domain:$public_port"; fi
printf 'Migration complete: %s\n' "$url"
