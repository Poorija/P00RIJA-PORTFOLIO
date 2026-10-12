#!/usr/bin/env bash

set -Eeuo pipefail

APP_NAME="p00rija-portfolio"
IMAGE_NAME="p00rija/portfolio:local"
CONTAINER_NAME="p00rija-portfolio"
LAUNCHD_LABEL="com.p00rija.portfolio"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
note() { printf '• %s\n' "$*"; }
warn() { printf '\033[33mWARN:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# Animated ASCII art banner — "P00RIJA PORTFOLIO" in a modern slant font.
# Renders frame-by-frame with a cyan→purple gradient and a typing effect.
# Falls back gracefully (no colors / no animation) on dumb terminals.
# ─────────────────────────────────────────────────────────────────────────────
show_banner() {
  # Skip animation when output is not a TTY (pipes, logs, non-interactive).
  if [ ! -t 1 ]; then
    printf '%s\n' "P00RIJA PORTFOLIO"
    return 0
  fi

  # Detect if the terminal supports 256 colors / truecolor.
  local has_colors=0
  if [ "${TERM:-}" != "dumb" ] && [ "${NO_COLOR:-}" = "" ]; then
    if [ "$(tput colors 2>/dev/null || echo 0)" -ge 256 ]; then
      has_colors=1
    fi
  fi

  # Big ASCII art — two lines stacked, "P00RIJA" on top, "PORTFOLIO" below.
  # Designed to be narrow enough for ~60-col terminals.
  #
  #  ██████  ██████   ██████ ██    ██ ███████ ███████
  # ██      ██    ██ ██      ██    ██ ██      ██
  # ██      ██    ██ ██   ███ ██    ██ █████   ███████
  # ██      ██    ██ ██    ██ ██    ██ ██           ██
  #  ██████  ██████   ██████  ██████  ███████ ███████
  #
  # ██████   ██████  ██ ███    ██ ██     ███████ ██████   ██████
  # ██   ██ ██    ██ ██ ████   ██ ██     ██      ██   ██ ██    ██
  # ███████ ██    ██ ██ ██ ██  ██ ██     █████   ██████  ██    ██
  # ██   ██ ██    ██ ██ ██  ██ ██ ██     ██      ██   ██ ██    ██
  # ██   ██  ██████  ██ ██   ████ ██████ ███████ ██   ██  ██████
  local art
  art=$(cat <<'ART'
  ██████  ██████   ██████ ██    ██ ███████ ███████
 ██      ██    ██ ██      ██    ██ ██      ██
 ██      ██    ██ ██   ███ ██    ██ █████   ███████
 ██      ██    ██ ██    ██ ██    ██ ██           ██
  ██████  ██████   ██████  ██████  ███████ ███████
 ██████   ██████  ██ ███    ██ ██     ███████ ██████   ██████
 ██   ██ ██    ██ ██ ████   ██ ██     ██      ██   ██ ██    ██
 ███████ ██    ██ ██ ██ ██  ██ ██     █████   ██████  ██    ██
 ██   ██ ██    ██ ██ ██  ██ ██ ██     ██      ██   ██ ██    ██
 ██   ██  ██████  ██ ██   ████ ██████ ███████ ██   ██  ██████
ART
)

  local lines=()
  while IFS= read -r line; do lines+=("$line"); done <<<"$art"
  local total=${#lines[@]}

  if [ "$has_colors" -eq 1 ]; then
    # Truecolor gradient: top lines are cyan (51,187,204), bottom are purple (180,100,230).
    # Each line gets an interpolated RGB based on its position.
    local i r g b
    for i in "${!lines[@]}"; do
      local frac=$(( i * 100 / (total - 1) ))
      # Interpolate cyan(51,187,204) → purple(180,100,230)
      r=$(( 51  + (180 - 51)  * frac / 100 ))
      g=$(( 187 + (100 - 187) * frac / 100 ))
      b=$(( 204 + (230 - 204) * frac / 100 ))
      printf '\033[38;2;%d;%d;%dm%s\033[0m\n' "$r" "$g" "$b" "${lines[$i]}"
      # Frame delay for the animation effect (only when interactive).
      [ "${P00RIJA_FAST_BANNER:-0}" = "1" ] || sleep 0.06
    done
  else
    # No color — just print with bold for emphasis.
    local line
    for line in "${lines[@]}"; do
      printf '\033[1m%s\033[0m\n' "$line"
      [ "${P00RIJA_FAST_BANNER:-0}" = "1" ] || sleep 0.04
    done
  fi

  # Subtitle line with a subtle separator.
  if [ "$has_colors" -eq 1 ]; then
    printf '\033[90m%s\033[0m\n' "────────────────────────────────────────────────"
    printf '\033[36m%s\033[0m\n'   "  Installer & Control Center v2 · Graphics · Security · AI"
  else
    printf '%s\n' "------------------------------------------------"
    printf '%s\n'   "  Installer & Control Center v2 · Graphics · Security · AI"
  fi
  printf '\n'
}

require_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    die "Run with sudo/root on the server: sudo bash install.sh"
  fi
}

ask() {
  local prompt="$1" default="${2:-}" answer
  if [ -n "$default" ]; then
    read -r -p "$prompt [$default]: " answer
    printf '%s' "${answer:-$default}"
  else
    read -r -p "$prompt: " answer
    printf '%s' "$answer"
  fi
}

ask_yes_no() {
  local prompt="$1" default="${2:-y}" answer suffix
  [ "$default" = "y" ] && suffix="Y/n" || suffix="y/N"
  read -r -p "$prompt [$suffix]: " answer
  answer="${answer:-$default}"
  case "$answer" in y|Y|yes|YES|Yes) return 0 ;; *) return 1 ;; esac
}

pause() {
  echo
  read -r -p "Press Enter to continue..." _
}

detect_ip() {
  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}' && return 0
  fi
  if [ "$(os_name)" = "Darwin" ]; then
    ipconfig getifaddr en0 2>/dev/null && return 0
    ipconfig getifaddr en1 2>/dev/null && return 0
    ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" { print $2; exit }' && return 0
  fi
  true
}

validate_port() {
  local port="$1"
  [[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ]
}

service_user() {
  local user="${SUDO_USER:-$(id -un)}"
  [ "$user" = "root" ] && user="$(id -un)"
  printf '%s' "$user"
}

state_dir() {
  printf '/var/lib/%s' "$APP_NAME"
}

compose_file() {
  printf '%s/docker-compose.server.yml' "$SCRIPT_DIR"
}

bind_host() {
  case "${1:-0.0.0.0}" in
    localhost) printf '127.0.0.1' ;;
    *) printf '%s' "${1:-0.0.0.0}" ;;
  esac
}

os_name() {
  uname -s 2>/dev/null || printf 'Unknown'
}

brew_bin() {
  if command -v brew >/dev/null 2>&1; then
    command -v brew
    return
  fi
  if [ -x /opt/homebrew/bin/brew ]; then printf '/opt/homebrew/bin/brew'; return; fi
  if [ -x /usr/local/bin/brew ]; then printf '/usr/local/bin/brew'; return; fi
  true
}

run_brew() {
  local brew user home
  brew="$(brew_bin)"
  [ -n "$brew" ] || die "Homebrew is required on macOS. Install it from https://brew.sh and run again."
  if [ "${EUID:-$(id -u)}" -eq 0 ] && [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    user="$SUDO_USER"
    home="$(eval echo "~$user")"
    sudo -u "$user" HOME="$home" "$brew" "$@"
  else
    "$brew" "$@"
  fi
}

homebrew_prefix() {
  local brew
  brew="$(brew_bin)"
  if [ -n "$brew" ]; then
    run_brew --prefix
  else
    printf '/opt/homebrew'
  fi
}

service_kind() {
  if [ "$(os_name)" = "Darwin" ]; then
    printf 'launchd'
  elif command -v systemctl >/dev/null 2>&1; then
    printf 'systemd'
  else
    printf 'none'
  fi
}

require_native_service_manager() {
  [ "$(service_kind)" != "none" ] || die "Native install needs systemd on Linux or launchd on macOS. Use Docker install on this OS."
}

launchd_plist_path() {
  printf '/Library/LaunchDaemons/%s.plist' "$LAUNCHD_LABEL"
}

nginx_bin() {
  local prefix
  if command -v nginx >/dev/null 2>&1; then
    command -v nginx
    return
  fi
  if [ "$(os_name)" = "Darwin" ]; then
    prefix="$(homebrew_prefix)"
    if [ -x "$prefix/bin/nginx" ]; then printf '%s/bin/nginx' "$prefix"; return; fi
    if [ -x "$prefix/sbin/nginx" ]; then printf '%s/sbin/nginx' "$prefix"; return; fi
  fi
  true
}

nginx_conf_path() {
  if [ "$(os_name)" = "Darwin" ]; then
    local prefix
    prefix="$(homebrew_prefix)"
    mkdir -p "$prefix/etc/nginx/servers"
    printf '%s/etc/nginx/servers/%s.conf' "$prefix" "$APP_NAME"
    return
  fi
  if [ -d /etc/nginx/sites-available ]; then
    printf '/etc/nginx/sites-available/%s.conf' "$APP_NAME"
  else
    printf '/etc/nginx/conf.d/%s.conf' "$APP_NAME"
  fi
}

ensure_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    note "Node.js: $(node --version), npm: $(npm --version)"
    return
  fi
  warn "Node.js/npm not found. Installing..."
  if [ "$(os_name)" = "Darwin" ]; then
    run_brew install node
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y nodejs npm
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nodejs npm
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nodejs npm
  else
    die "Install Node.js 20+ and npm, then run again."
  fi
}

ensure_media_tools() {
  if command -v ffmpeg >/dev/null 2>&1; then
    note "FFmpeg: $(ffmpeg -version 2>/dev/null | sed -n '1p')"
    return
  fi
  note "Installing FFmpeg for CMS audio/video editing..."
  if [ "$(os_name)" = "Darwin" ]; then
    run_brew install ffmpeg
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y ffmpeg
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y ffmpeg
  elif command -v yum >/dev/null 2>&1; then
    yum install -y ffmpeg
  else
    die "Install FFmpeg, then run again."
  fi
}

ensure_nginx() {
  if [ -n "$(nginx_bin)" ]; then
    note "Nginx found: $(nginx_bin)"
    ensure_homebrew_nginx_include
    return
  fi
  note "Installing Nginx..."
  if [ "$(os_name)" = "Darwin" ]; then
    run_brew install nginx
    ensure_homebrew_nginx_include
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nginx
  else
    die "Install Nginx, then run again."
  fi
}

ensure_homebrew_nginx_include() {
  [ "$(os_name)" = "Darwin" ] || return 0
  local prefix conf include_line owner group
  prefix="$(homebrew_prefix)"
  conf="$prefix/etc/nginx/nginx.conf"
  include_line="include $prefix/etc/nginx/servers/*.conf;"
  mkdir -p "$prefix/etc/nginx/servers"
  [ -f "$conf" ] || return 0
  if ! grep -Fq "$include_line" "$conf"; then
    note "Adding Homebrew Nginx servers include to $conf"
    owner="$(stat -f '%Su' "$conf" 2>/dev/null || true)"
    group="$(stat -f '%Sg' "$conf" 2>/dev/null || true)"
    cp "$conf" "$conf.bak.$(date +%Y%m%d%H%M%S)"
    awk -v inc="    include $prefix/etc/nginx/servers/*.conf;" '
      /http[[:space:]]*\{/ && !done { print; print inc; done=1; next }
      { print }
    ' "$conf" > "$conf.tmp"
    mv "$conf.tmp" "$conf"
    [ -n "$owner" ] && [ -n "$group" ] && chown "$owner:$group" "$conf" 2>/dev/null || true
  fi
}

ensure_certbot() {
  if command -v certbot >/dev/null 2>&1; then return; fi
  note "Installing certbot..."
  if [ "$(os_name)" = "Darwin" ]; then
    run_brew install certbot
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y certbot python3-certbot-nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y certbot python3-certbot-nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y certbot python3-certbot-nginx
  else
    die "Install certbot, then run again."
  fi
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    note "Docker found: $(docker --version)"
    return
  fi
  warn "Docker not found. Installing distribution package..."
  if [ "$(os_name)" = "Darwin" ]; then
    die "Install Docker Desktop or OrbStack on macOS, start it, then run again."
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y docker.io
    if apt-cache show docker-compose-v2 >/dev/null 2>&1; then
      apt-get install -y docker-compose-v2
    elif apt-cache show docker-compose-plugin >/dev/null 2>&1; then
      apt-get install -y docker-compose-plugin
    else
      apt-get install -y docker-compose
    fi
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y docker docker-compose-plugin
  elif command -v yum >/dev/null 2>&1; then
    yum install -y docker docker-compose-plugin
  else
    die "Install Docker, then run again."
  fi
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable docker
    systemctl start docker
  fi

  docker info >/dev/null 2>&1 || die "Docker is installed but the daemon is not reachable. Start Docker and run again."
  docker_compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."
}

ensure_web_prerequisites() {
  local missing=()
  for command_name in openssl curl awk sed grep; do
    command -v "$command_name" >/dev/null 2>&1 || missing+=("$command_name")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    note "Installing web prerequisites: ${missing[*]}"
    if [ "$(os_name)" = "Darwin" ]; then
      run_brew install openssl curl
    elif command -v apt-get >/dev/null 2>&1; then
      apt-get update && apt-get install -y ca-certificates curl openssl
    elif command -v dnf >/dev/null 2>&1; then
      dnf install -y ca-certificates curl openssl
    elif command -v yum >/dev/null 2>&1; then
      yum install -y ca-certificates curl openssl
    else
      die "Unsupported OS package manager. Install: ${missing[*]}"
    fi
  fi
  for command_name in openssl curl awk sed grep; do
    command -v "$command_name" >/dev/null 2>&1 || die "Prerequisite still missing: $command_name"
  done
  [ -f "$SCRIPT_DIR/Dockerfile" ] || die "Dockerfile not found in $SCRIPT_DIR"
  [ -f "$SCRIPT_DIR/docker/nginx/nginx.conf" ] || die "docker/nginx/nginx.conf not found"
  [ -f "$SCRIPT_DIR/docker/certbot/entrypoint.sh" ] || die "docker/certbot/entrypoint.sh not found"
  docker info >/dev/null 2>&1 || die "Docker daemon is not reachable. Start Docker and run again."
  docker_compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."
}

ensure_low_memory_swap() {
  [ "$(os_name)" = "Linux" ] || return 0
  [ "${P00RIJA_AUTO_SWAP:-1}" != "0" ] || return 0

  local memory_kb swap_kb swap_file free_kb
  memory_kb="$(awk '/MemTotal:/ { print $2; exit }' /proc/meminfo 2>/dev/null || echo 0)"
  swap_kb="$(awk '/SwapTotal:/ { print $2; exit }' /proc/meminfo 2>/dev/null || echo 0)"
  [ "$memory_kb" -gt 0 ] 2>/dev/null || return 0
  [ "$memory_kb" -le 1572864 ] || return 0
  [ "$swap_kb" -lt 1048576 ] || { note "Low-memory host already has sufficient swap."; return 0; }

  if ! command -v mkswap >/dev/null 2>&1 || ! command -v swapon >/dev/null 2>&1; then
    note "Installing swap utilities for low-memory build support..."
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update && apt-get install -y util-linux
    elif command -v dnf >/dev/null 2>&1; then
      dnf install -y util-linux
    elif command -v yum >/dev/null 2>&1; then
      yum install -y util-linux
    else
      warn "Swap utilities unavailable; continuing without automatic swap."
      return 0
    fi
  fi

  swap_file="$(state_dir)/p00rija-build.swap"
  mkdir -p "$(state_dir)"
  if grep -qF "$swap_file" /proc/swaps 2>/dev/null; then
    note "P00RIJA low-memory swap is already active."
    return 0
  fi

  free_kb="$(df -Pk "$(state_dir)" | awk 'NR==2 { print $4 }')"
  if [ "${free_kb:-0}" -lt 2359296 ] 2>/dev/null; then
    warn "Less than 2.25 GB disk space is free; cannot create the recommended 2 GB build swap."
    return 0
  fi

  note "Creating a 2 GB swap file for the low-memory Docker build..."
  if [ ! -f "$swap_file" ]; then
    if command -v fallocate >/dev/null 2>&1; then
      fallocate -l 2G "$swap_file" || dd if=/dev/zero of="$swap_file" bs=1M count=2048
    else
      dd if=/dev/zero of="$swap_file" bs=1M count=2048
    fi
  fi
  chmod 600 "$swap_file"
  mkswap "$swap_file" >/dev/null
  if swapon "$swap_file"; then
    grep -qF "$swap_file" /etc/fstab 2>/dev/null || printf '%s none swap sw 0 0\n' "$swap_file" >> /etc/fstab
    note "Low-memory swap enabled and persisted across reboots."
  else
    warn "The host rejected swapon (common on restricted VPS containers); continuing with the larger single-worker build heap."
  fi
}

configure_adaptive_container_resources() {
  local memory_mb cpu_count profile cpu_limit app_memory_mb
  memory_mb="$(awk '/MemTotal:/ { printf "%d\n", $2 / 1024; exit }' /proc/meminfo 2>/dev/null || echo 1024)"
  if command -v nproc >/dev/null 2>&1; then
    cpu_count="$(nproc)"
  else
    cpu_count="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1)"
  fi
  memory_mb="${P00RIJA_HOST_MEMORY_MB_OVERRIDE:-$memory_mb}"
  cpu_count="${P00RIJA_HOST_CPU_COUNT_OVERRIDE:-$cpu_count}"
  [ "$memory_mb" -gt 0 ] 2>/dev/null || memory_mb=1024
  [ "$cpu_count" -gt 0 ] 2>/dev/null || cpu_count=1

  if [ "$memory_mb" -le 1536 ] || [ "$cpu_count" -le 1 ]; then
    profile=eco
    # Reserve roughly 35% RAM and 30% of one CPU for the OS, SSH, Docker,
    # Nginx, and certificate renewal. The app remains responsive but bounded.
    app_memory_mb=$((memory_mb * 65 / 100))
    [ "$app_memory_mb" -lt 384 ] && app_memory_mb=384
    [ "$app_memory_mb" -gt 768 ] && app_memory_mb=768
    cpu_limit="$(awk -v c="$cpu_count" 'BEGIN { v=c*0.70; if (v<0.50) v=0.50; printf "%.2f", v }')"
  elif [ "$memory_mb" -le 4096 ] || [ "$cpu_count" -le 4 ]; then
    profile=balanced
    app_memory_mb=$((memory_mb * 70 / 100))
    [ "$app_memory_mb" -gt 2560 ] && app_memory_mb=2560
    cpu_limit="$(awk -v c="$cpu_count" 'BEGIN { v=c*0.80; if (v<1) v=1; printf "%.2f", v }')"
  else
    profile=performance
    app_memory_mb=$((memory_mb * 75 / 100))
    [ "$app_memory_mb" -gt 8192 ] && app_memory_mb=8192
    cpu_limit="$(awk -v c="$cpu_count" 'BEGIN { v=c*0.90; printf "%.2f", v }')"
  fi

  [ -z "${P00RIJA_CPUS:-}" ] || cpu_limit="$P00RIJA_CPUS"
  if [ -n "${P00RIJA_MEMORY_LIMIT:-}" ]; then
    upsert_env_key "P00RIJA_MEMORY_LIMIT" "$P00RIJA_MEMORY_LIMIT"
  else
    upsert_env_key "P00RIJA_MEMORY_LIMIT" "${app_memory_mb}m"
  fi
  upsert_env_key "P00RIJA_CPUS" "$cpu_limit"
  upsert_env_key "P00RIJA_RESOURCE_PROFILE" "$profile"
  upsert_env_key "P00RIJA_HOST_MEMORY_MB" "$memory_mb"
  upsert_env_key "P00RIJA_HOST_CPUS" "$cpu_count"
  note "Adaptive resources: profile=$profile, host=${cpu_count}CPU/${memory_mb}MB, app_cpu=$cpu_limit, app_memory=$(grep '^P00RIJA_MEMORY_LIMIT=' "$SCRIPT_DIR/.env" | cut -d= -f2-)"
}

build_web_image_adaptively() {
  local profile host_memory_mb host_cpus build_memory_mb build_swap_mb cpu_quota
  if [ -n "${P00RIJA_PREBUILT_IMAGE_PATH:-}" ]; then
    [ -f "$P00RIJA_PREBUILT_IMAGE_PATH" ] || die "Prebuilt image archive not found: $P00RIJA_PREBUILT_IMAGE_PATH"
    note "Loading prebuilt application image (server compilation is skipped)..."
    case "$P00RIJA_PREBUILT_IMAGE_PATH" in
      *.gz) gzip -dc "$P00RIJA_PREBUILT_IMAGE_PATH" | docker load ;;
      *) docker load -i "$P00RIJA_PREBUILT_IMAGE_PATH" ;;
    esac
    if [ -n "${P00RIJA_PREBUILT_IMAGE_REF:-}" ]; then
      docker image inspect "$P00RIJA_PREBUILT_IMAGE_REF" >/dev/null 2>&1 \
        || die "Loaded archive does not contain $P00RIJA_PREBUILT_IMAGE_REF"
      docker tag "$P00RIJA_PREBUILT_IMAGE_REF" "$IMAGE_NAME"
    fi
    docker image inspect "$IMAGE_NAME" >/dev/null 2>&1 \
      || die "Prebuilt archive did not provide the expected image: $IMAGE_NAME"
    rm -f "$P00RIJA_PREBUILT_IMAGE_PATH"
    return
  fi

  profile="$(grep '^P00RIJA_RESOURCE_PROFILE=' "$SCRIPT_DIR/.env" | cut -d= -f2- || true)"
  host_memory_mb="$(grep '^P00RIJA_HOST_MEMORY_MB=' "$SCRIPT_DIR/.env" | cut -d= -f2- || true)"
  host_cpus="$(grep '^P00RIJA_HOST_CPUS=' "$SCRIPT_DIR/.env" | cut -d= -f2- || true)"
  profile="${profile:-balanced}"
  host_memory_mb="${host_memory_mb:-2048}"
  host_cpus="${host_cpus:-1}"

  case "$profile" in
    eco)
      cpu_quota=$((host_cpus * 55000))
      build_memory_mb=$((host_memory_mb * 92 / 100))
      [ "$build_memory_mb" -lt 640 ] && build_memory_mb=640
      [ "$build_memory_mb" -gt 1152 ] && build_memory_mb=1152
      build_swap_mb=$((build_memory_mb + 2048))
      ;;
    balanced)
      cpu_quota=$((host_cpus * 75000))
      build_memory_mb=$((host_memory_mb * 80 / 100))
      [ "$build_memory_mb" -gt 3072 ] && build_memory_mb=3072
      build_swap_mb=$((build_memory_mb + 1024))
      ;;
    *)
      cpu_quota=$((host_cpus * 90000))
      build_memory_mb=$((host_memory_mb * 75 / 100))
      [ "$build_memory_mb" -gt 6144 ] && build_memory_mb=6144
      build_swap_mb=$((build_memory_mb + 1024))
      ;;
  esac

  note "Adaptive image build: profile=$profile, cpu_quota=$((cpu_quota / 1000))%, memory=${build_memory_mb}MB, memory+swap=${build_swap_mb}MB"
  nice -n 10 docker build \
    --cpu-period=100000 --cpu-quota="$cpu_quota" \
    --memory="${build_memory_mb}m" --memory-swap="${build_swap_mb}m" \
    --build-arg "P00RIJA_BUILD_MEMORY_MB=$build_memory_mb" \
    --build-arg "P00RIJA_BUILD_CPUS=$host_cpus" \
    -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"
}

validate_public_domain() {
  local domain="$1"
  [[ "$domain" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]]
}

check_domain_dns() {
  local domain="$1"
  if command -v getent >/dev/null 2>&1; then
    getent ahosts "$domain" >/dev/null 2>&1 || die "DNS does not resolve for $domain. Create its A/AAAA record first."
  elif command -v dscacheutil >/dev/null 2>&1; then
    dscacheutil -q host -a name "$domain" | grep -q 'ip_address' || die "DNS does not resolve for $domain. Create its A/AAAA record first."
  else
    warn "DNS resolver tool not found; domain resolution check skipped."
  fi
}

docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    die "Docker Compose was not found."
  fi
}

install_dependencies_and_build() {
  ensure_node
  ensure_media_tools
  note "Installing dependencies..."
  if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
  note "Generating Prisma client and syncing database..."
  npx prisma generate
  npx prisma db push
  note "Building production bundle..."
  sh scripts/hardware-profile.sh build npm run build
}

# Ask for the initial CMS admin password.
# Order: P00RIJA_ADMIN_PASSWORD env (automation) → interactive prompt
# (asked twice, hidden input) → documented default shipped in
# prisma/default-admin-password.txt with a loud warning.
ask_admin_password() {
  if [ -n "${P00RIJA_ADMIN_PASSWORD:-}" ]; then
    note "Using CMS admin password from P00RIJA_ADMIN_PASSWORD."
    printf '%s' "$P00RIJA_ADMIN_PASSWORD"
    return
  fi
  if [ ! -t 0 ]; then
    warn "Non-interactive shell: using the DEFAULT CMS password — change it immediately!"
    printf '%s' "$(head -n 1 "$SCRIPT_DIR/prisma/default-admin-password.txt" 2>/dev/null | tr -d '[:space:]')"
    return
  fi
  local first second default_value
  default_value="$(head -n 1 "$SCRIPT_DIR/prisma/default-admin-password.txt" 2>/dev/null | tr -d '[:space:]')"
  while true; do
    printf 'CMS admin password (empty = insecure default): '
    read -rs first || first=""
    echo
    if [ -z "$first" ]; then
      warn "Using the DEFAULT CMS password — CHANGE IT IMMEDIATELY after first login!"
      printf '%s' "$default_value"
      return
    fi
    printf 'Repeat CMS admin password: '
    read -rs second || second=""
    echo
    if [ "$first" != "$second" ]; then
      warn "Passwords do not match — try again."
      continue
    fi
    printf '%s' "$first"
    return
  done
}

# Upsert a KEY=VALUE line in the .env file. If the key already exists its value
# is updated in place; if not, it is appended. This replaces the old append-only
# pattern that left stale PORT values from a prior run.
upsert_env_key() {
  local key="$1" value="$2" env_file="$SCRIPT_DIR/.env"
  touch "$env_file"
  if grep -q "^${key}=" "$env_file"; then
    # Update existing line. Escape / for the sed replacement.
    local esc_value
    esc_value="$(printf '%s' "$value" | sed 's/[\/&]/\\&/g')"
    sed -i.bak "s|^${key}=.*|${key}=${esc_value}|" "$env_file"
    rm -f "$env_file.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$env_file"
  fi
}

write_env() {
  local app_port="$1" hide_indicator="${2:-1}"
  touch "$SCRIPT_DIR/.env"
  # AUTH_SECRET is generated once and kept (it invalidates sessions if rotated).
  if ! grep -q '^AUTH_SECRET=' "$SCRIPT_DIR/.env"; then
    upsert_env_key "AUTH_SECRET" "$(openssl rand -hex 32 2>/dev/null || date +%s%N)"
  fi
  if ! grep -q '^ADMIN_PASSWORD=' "$SCRIPT_DIR/.env"; then
    local entry_value
    entry_value="$(ask_admin_password)"
    upsert_env_key "ADMIN_PASSWORD" "$entry_value"
    if [ "$entry_value" = "$(head -n 1 "$SCRIPT_DIR/prisma/default-admin-password.txt" 2>/dev/null | tr -d '[:space:]')" ]; then
      warn "Initial CMS password is the PUBLIC DEFAULT — see DEFAULT-CMS-PASSWORD.txt. Change it immediately!"
    else
      note "CMS admin password saved to .env (ADMIN_PASSWORD)."
    fi
  fi
  upsert_env_key "PORT" "$app_port"
  upsert_env_key "HIDE_NEXT_DEV_INDICATOR" "$hide_indicator"
  upsert_env_key "P00RIJA_DISTRIBUTION_MODE" "${P00RIJA_DISTRIBUTION_MODE:-full}"
}

write_systemd_service() {
  local app_port="$1" app_host="${2:-127.0.0.1}" user
  user="$(service_user)"
  mkdir -p "$SCRIPT_DIR/db"
  touch "$SCRIPT_DIR/server.log"
  chown -R "$user":"$user" "$SCRIPT_DIR/db" "$SCRIPT_DIR/server.log" "$SCRIPT_DIR/.next" 2>/dev/null || true
  cat > "/etc/systemd/system/$APP_NAME.service" <<SERVICE
[Unit]
Description=P00RIJA Portfolio Next.js app
After=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$SCRIPT_DIR
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=HIDE_NEXT_DEV_INDICATOR=1
ExecStart=$SCRIPT_DIR/run.sh --prod --port $app_port --host $app_host --no-install --no-build --hide-dev-indicator
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE
  systemctl daemon-reload
  systemctl enable "$APP_NAME"
  systemctl restart "$APP_NAME"
}

write_launchd_service() {
  local app_port="$1" app_host="${2:-127.0.0.1}" user plist
  user="$(service_user)"
  plist="$(launchd_plist_path)"
  mkdir -p "$SCRIPT_DIR/db"
  touch "$SCRIPT_DIR/server.log"
  chown -R "$user":staff "$SCRIPT_DIR/db" "$SCRIPT_DIR/server.log" "$SCRIPT_DIR/.next" 2>/dev/null || true
  cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LAUNCHD_LABEL</string>
  <key>UserName</key>
  <string>$user</string>
  <key>WorkingDirectory</key>
  <string>$SCRIPT_DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SCRIPT_DIR/run.sh</string>
    <string>--prod</string>
    <string>--port</string>
    <string>$app_port</string>
    <string>--host</string>
    <string>$app_host</string>
    <string>--no-install</string>
    <string>--no-build</string>
    <string>--hide-dev-indicator</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>NEXT_TELEMETRY_DISABLED</key>
    <string>1</string>
    <key>HIDE_NEXT_DEV_INDICATOR</key>
    <string>1</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StandardOutPath</key>
  <string>$SCRIPT_DIR/server.log</string>
  <key>StandardErrorPath</key>
  <string>$SCRIPT_DIR/server.log</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
PLIST
  chmod 644 "$plist"
  chown root:wheel "$plist" 2>/dev/null || true
  launchctl bootout system "$plist" >/dev/null 2>&1 || true
  launchctl bootstrap system "$plist"
  launchctl kickstart -k "system/$LAUNCHD_LABEL"
}

write_native_service() {
  local app_port="$1" app_host="${2:-127.0.0.1}"
  case "$(service_kind)" in
    launchd) write_launchd_service "$app_port" "$app_host" ;;
    systemd) write_systemd_service "$app_port" "$app_host" ;;
    *) require_native_service_manager ;;
  esac
}

restart_native_service() {
  case "$(service_kind)" in
    launchd)
      launchctl kickstart -k "system/$LAUNCHD_LABEL" 2>/dev/null || write_launchd_service "$(ask "Internal app port" "3000")"
      ;;
    systemd)
      systemctl restart "$APP_NAME" || warn "Native service was not running."
      ;;
    *) require_native_service_manager ;;
  esac
}

stop_native_service() {
  case "$(service_kind)" in
    launchd) launchctl bootout system "$(launchd_plist_path)" >/dev/null 2>&1 || true ;;
    systemd) systemctl stop "$APP_NAME" 2>/dev/null || true ;;
    *) true ;;
  esac
}

remove_native_service() {
  case "$(service_kind)" in
    launchd)
      launchctl bootout system "$(launchd_plist_path)" >/dev/null 2>&1 || true
      rm -f "$(launchd_plist_path)"
      ;;
    systemd)
      systemctl stop "$APP_NAME" 2>/dev/null || true
      systemctl disable "$APP_NAME" 2>/dev/null || true
      rm -f "/etc/systemd/system/$APP_NAME.service"
      systemctl daemon-reload
      ;;
    *) require_native_service_manager ;;
  esac
}

make_self_signed_cert() {
  local host="$1" cert_dir="${2:-/etc/ssl/$APP_NAME}" san
  san="DNS:$host"
  if [[ "$host" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    san="$san,IP:$host"
  fi
  mkdir -p "$cert_dir"
  chmod 700 "$cert_dir"
  openssl req -x509 -nodes -newkey rsa:4096 -days 825 \
    -keyout "$cert_dir/privkey.pem" \
    -out "$cert_dir/fullchain.pem" \
    -subj "/CN=$host" \
    -addext "subjectAltName=$san" >/dev/null 2>&1 || \
    openssl req -x509 -nodes -newkey rsa:4096 -days 825 \
      -keyout "$cert_dir/privkey.pem" \
      -out "$cert_dir/fullchain.pem" \
      -subj "/CN=$host" >/dev/null 2>&1
  printf '%s|%s' "$cert_dir/fullchain.pem" "$cert_dir/privkey.pem"
}

enable_nginx_conf() {
  local conf="$1"
  if [ -d /etc/nginx/sites-enabled ]; then
    ln -sf "$conf" "/etc/nginx/sites-enabled/$(basename "$conf")"
  fi
}

write_nginx_http() {
  local host="$1" public_port="$2" app_port="$3" conf
  conf="$(nginx_conf_path)"
  cat > "$conf" <<NGINX
server {
    listen $public_port;
    listen [::]:$public_port;
    server_name $host;
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:$app_port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
  enable_nginx_conf "$conf"
}

write_nginx_https() {
  local host="$1" public_port="$2" app_port="$3" cert_path="$4" key_path="$5" conf https_target
  conf="$(nginx_conf_path)"
  if [ "$public_port" = "443" ]; then
    https_target="https://\$host\$request_uri"
  else
    https_target="https://\$host:$public_port\$request_uri"
  fi
  cat > "$conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $host;
    return 301 $https_target;
}

server {
    listen $public_port ssl http2;
    listen [::]:$public_port ssl http2;
    server_name $host;

    ssl_certificate $cert_path;
    ssl_certificate_key $key_path;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozSSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:$app_port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
  enable_nginx_conf "$conf"
}

test_and_reload_nginx() {
  local nginx
  nginx="$(nginx_bin)"
  [ -n "$nginx" ] || die "Nginx was not found."
  "$nginx" -t
  if [ "$(os_name)" = "Darwin" ]; then
    "$nginx" -s reload 2>/dev/null || "$nginx"
  else
    systemctl enable nginx
    systemctl reload nginx || systemctl restart nginx
  fi
}

configure_nginx_frontend() {
  local public_host="$1" public_port="$2" app_port="$3" use_ssl ssl_mode cert_path key_path le_email
  ensure_nginx
  if ask_yes_no "Use SSL/HTTPS? Recommended" "y"; then use_ssl=1; else use_ssl=0; fi
  if [ "$use_ssl" = "1" ]; then
    [ "$public_port" != "80" ] || die "HTTPS public port cannot be 80 because port 80 is reserved for HTTP to HTTPS redirect."
    echo
    echo "SSL mode:"
    echo "  1) Use existing certificate files"
    echo "  2) Create trusted Let's Encrypt certificate with certbot"
    echo "  3) Create local self-signed certificate"
    ssl_mode="$(ask "Choose SSL mode" "1")"
    case "$ssl_mode" in
      1)
        cert_path="$(ask "Path to fullchain/certificate file" "/etc/letsencrypt/live/$public_host/fullchain.pem")"
        key_path="$(ask "Path to private key file" "/etc/letsencrypt/live/$public_host/privkey.pem")"
        [ -f "$cert_path" ] || die "Certificate file not found: $cert_path"
        [ -f "$key_path" ] || die "Private key file not found: $key_path"
        ;;
      2)
        if [[ "$public_host" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [ "$public_host" = "localhost" ] || [ "$public_host" = "127.0.0.1" ]; then
          die "Let's Encrypt needs a real public domain, not localhost or raw IP. Use existing certs or self-signed for local/IP installs."
        fi
        le_email="$(ask "Let's Encrypt email" "admin@$public_host")"
        ensure_certbot
        write_nginx_http "$public_host" 80 "$app_port"
        test_and_reload_nginx
        certbot --nginx -d "$public_host" --non-interactive --agree-tos -m "$le_email" --redirect || die "certbot failed"
        cert_path="/etc/letsencrypt/live/$public_host/fullchain.pem"
        key_path="/etc/letsencrypt/live/$public_host/privkey.pem"
        ;;
      3)
        IFS='|' read -r cert_path key_path <<<"$(make_self_signed_cert "$public_host")"
        ;;
      *) die "Invalid SSL mode." ;;
    esac
    write_nginx_https "$public_host" "$public_port" "$app_port" "$cert_path" "$key_path"
  else
    write_nginx_http "$public_host" "$public_port" "$app_port"
  fi
  test_and_reload_nginx
}

ask_network() {
  local detected_ip default_host public_host public_port app_port
  detected_ip="$(detect_ip)"
  if [ "$(os_name)" = "Darwin" ]; then
    default_host="127.0.0.1"
  else
    default_host="${detected_ip:-127.0.0.1}"
  fi
  public_host="$(ask "Server host/domain/IP" "$default_host")"
  public_port="$(ask "Public port" "443")"
  validate_port "$public_port" || die "Invalid public port: $public_port"
  app_port="$(ask "Internal app port behind Nginx" "3000")"
  validate_port "$app_port" || die "Invalid internal app port: $app_port"
  printf '%s|%s|%s' "$public_host" "$public_port" "$app_port"
}

ask_direct_network() {
  local host app_port
  host="$(ask "Bind host (0.0.0.0 exposes LAN/server IP/domain)" "0.0.0.0")"
  app_port="$(ask "Local app port" "3000")"
  validate_port "$app_port" || die "Invalid local app port: $app_port"
  printf '%s|%s' "$host" "$app_port"
}

print_done() {
  local public_host="$1" public_port="$2" mode="$3"
  echo
  bold "Done"
  note "Mode: $mode"
  note "Public host: $public_host"
  note "Public port: $public_port"
  if [ "$(service_kind)" = "launchd" ]; then
    note "Native logs: tail -f $SCRIPT_DIR/server.log"
  else
    note "Native logs: journalctl -u $APP_NAME -f"
  fi
  note "Docker logs: docker logs -f $CONTAINER_NAME"
}

print_direct_done() {
  local host="$1" app_port="$2" mode="$3"
  echo
  bold "Done"
  note "Mode: $mode"
  note "Local URL: http://$host:$app_port"
  if [ "$(service_kind)" = "launchd" ]; then
    note "Native logs: tail -f $SCRIPT_DIR/server.log"
  else
    note "Native logs: journalctl -u $APP_NAME -f"
  fi
  note "Docker logs: docker logs -f $CONTAINER_NAME"
}

install_local() {
  require_root
  require_native_service_manager
  local public_host public_port app_port hide_indicator direct_host use_proxy
  if ask_yes_no "Configure Nginx/SSL reverse proxy in front" "n"; then
    use_proxy=1
    IFS='|' read -r public_host public_port app_port <<<"$(ask_network)"
  else
    use_proxy=0
    IFS='|' read -r direct_host app_port <<<"$(ask_direct_network)"
  fi
  ask_yes_no "Hide Next.js/Node debug indicator in dev too" "y" && hide_indicator=1 || hide_indicator=0
  write_env "$app_port" "$hide_indicator"
  install_dependencies_and_build
  if [ "$use_proxy" = "1" ]; then
    write_native_service "$app_port" "127.0.0.1"
    configure_nginx_frontend "$public_host" "$public_port" "$app_port"
    print_done "$public_host" "$public_port" "native"
  else
    write_native_service "$app_port" "$(bind_host "$direct_host")"
    print_direct_done "$direct_host" "$app_port" "native localhost"
  fi
}

write_compose_file() {
  local app_port="$1" host="${2:-0.0.0.0}" state
  host="$(bind_host "$host")"
  state="$(state_dir)"
  mkdir -p "$state/db" "$state/logs"
  cat > "$(compose_file)" <<YAML
services:
  portfolio:
    build:
      context: .
      dockerfile: Dockerfile
    image: $IMAGE_NAME
    container_name: $CONTAINER_NAME
    restart: unless-stopped
    env_file:
      - .env
    environment:
      NODE_ENV: production
      NEXT_TELEMETRY_DISABLED: "1"
      HIDE_NEXT_DEV_INDICATOR: "1"
      HOSTNAME: 0.0.0.0
      PORT: 3000
      DATABASE_URL: file:/app/db/custom.db
    ports:
      - "$host:$app_port:3000"
    volumes:
      - $state/db:/app/db
      - $state/logs:/app/logs
    init: true
    cpus: "\${P00RIJA_CPUS:-0}"
    mem_limit: "\${P00RIJA_MEMORY_LIMIT:-0}"
    pids_limit: 256
    stop_grace_period: 20s
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 20s
      timeout: 5s
      retries: 5
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
YAML
}

install_docker() {
  require_root
  local public_host public_port app_port hide_indicator direct_host use_proxy
  if ask_yes_no "Configure Nginx/SSL reverse proxy in front" "n"; then
    use_proxy=1
    IFS='|' read -r public_host public_port app_port <<<"$(ask_network)"
  else
    use_proxy=0
    IFS='|' read -r direct_host app_port <<<"$(ask_direct_network)"
  fi
  ask_yes_no "Hide Next.js/Node debug indicator in dev too" "y" && hide_indicator=1 || hide_indicator=0
  write_env "$app_port" "$hide_indicator"
  ensure_docker
  if [ "$use_proxy" = "1" ]; then
    write_compose_file "$app_port" "127.0.0.1"
  else
    write_compose_file "$app_port" "$direct_host"
  fi
  note "Building and starting Docker container..."
  docker_compose -f "$(compose_file)" up -d --build
  if [ "$use_proxy" = "1" ]; then
    configure_nginx_frontend "$public_host" "$public_port" "$app_port"
    print_done "$public_host" "$public_port" "docker"
  else
    print_direct_done "$direct_host" "$app_port" "docker localhost"
  fi
}

update_local() {
  require_root
  require_native_service_manager
  note "Updating local installation..."
  if [ -d .git ]; then
    if ask_yes_no "Run git pull before build" "n"; then git pull --ff-only; fi
  fi
  install_dependencies_and_build
  restart_native_service
  note "Native app updated."
}

update_docker() {
  require_root
  ensure_docker
  if [ -d .git ]; then
    if ask_yes_no "Run git pull before Docker rebuild" "n"; then git pull --ff-only; fi
  fi
  [ -f "$(compose_file)" ] || write_compose_file "$(ask "Internal app port behind Nginx" "3000")"
  docker_compose -f "$(compose_file)" up -d --build
  note "Docker app updated."
}

reset_local() {
  require_root
  require_native_service_manager
  warn "This resets app database/content but keeps service, Nginx and dependencies."
  ask_yes_no "Continue with native reset" "n" || return
  stop_native_service
  rm -f "$SCRIPT_DIR/db/custom.db" "$SCRIPT_DIR/db/custom.db-journal" "$SCRIPT_DIR/db/custom.db-wal" "$SCRIPT_DIR/db/custom.db-shm"
  install_dependencies_and_build
  write_native_service "$(ask "Internal app port" "3000")"
  note "Native app reset complete."
}

reset_docker() {
  require_root
  warn "This resets Docker container and database volume for this app."
  ask_yes_no "Continue with Docker reset" "n" || return
  ensure_docker
  if [ -f "$(compose_file)" ]; then
    docker_compose -f "$(compose_file)" down --remove-orphans || true
  fi
  rm -rf "$(state_dir)/db"
  mkdir -p "$(state_dir)/db"
  if [ -f "$(compose_file)" ]; then
    docker_compose -f "$(compose_file)" up -d --build
  else
    install_docker
  fi
  note "Docker reset complete."
}

uninstall_local() {
  require_root
  require_native_service_manager
  warn "This removes the native service and Nginx config. Optionally deletes DB/build files."
  ask_yes_no "Continue uninstall native install" "n" || return
  remove_native_service
  remove_nginx_config
  if ask_yes_no "Delete local DB, build and logs too" "n"; then
    rm -rf "$SCRIPT_DIR/db" "$SCRIPT_DIR/.next" "$SCRIPT_DIR/server.log" "$SCRIPT_DIR/dev.log"
  fi
  note "Native uninstall complete."
}

uninstall_docker() {
  require_root
  warn "This stops/removes Docker container, compose file and optionally Docker data."
  ask_yes_no "Continue uninstall Docker install" "n" || return
  ensure_docker
  [ -f "$(compose_file)" ] && docker_compose -f "$(compose_file)" down --remove-orphans || true
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  if ask_yes_no "Remove Docker image too" "y"; then docker rmi "$IMAGE_NAME" 2>/dev/null || true; fi
  if ask_yes_no "Delete Docker persistent data too" "n"; then rm -rf "$(state_dir)"; fi
  rm -f "$(compose_file)"
  remove_nginx_config
  note "Docker uninstall complete."
}

remove_nginx_config() {
  local conf nginx
  conf="$(nginx_conf_path)"
  rm -f "$conf"
  [ -d /etc/nginx/sites-enabled ] && rm -f "/etc/nginx/sites-enabled/$(basename "$conf")"
  nginx="$(nginx_bin)"
  if [ -n "$nginx" ]; then
    if [ "$(os_name)" = "Darwin" ]; then
      "$nginx" -t && ("$nginx" -s reload 2>/dev/null || "$nginx") || warn "Nginx config test failed after removal."
    else
      "$nginx" -t && (systemctl reload nginx || systemctl restart nginx) || warn "Nginx config test failed after removal."
    fi
  fi
}

# ═════════════════════════════════════════════════════════════════════════════
# WEB DEPLOYMENT — Docker + Nginx + SSL (multi-container, all in Docker)
# ═════════════════════════════════════════════════════════════════════════════

# The HTTPS ports Cloudflare CDN allows for origin connections.
WEB_COMPOSE_FILE="$SCRIPT_DIR/docker-compose.web.yml"
WEB_NGINX_DIR="$SCRIPT_DIR/docker/nginx"
CF_HTTPS_PORTS="443 2053 2083 2087 2096 8443"

web_compose_file() { printf '%s' "$WEB_COMPOSE_FILE"; }

is_cloudflare_port() {
  local port="$1"
  for p in $CF_HTTPS_PORTS; do [ "$p" = "$port" ] && return 0; done
  return 1
}

# Generate docker/nginx/default.conf for the web deployment.
# Args: domain https_port app_upstream cert_path key_path ssl_active(0|1)
write_nginx_web_conf() {
  local domain="$1" https_port="$2" app_upstream="$3" cert_path="$4" key_path="$5" ssl_active="$6"
  local conf="$WEB_NGINX_DIR/default.conf"
  local https_target
  if [ "$https_port" = "443" ]; then
    https_target='https://$host$request_uri'
  else
    https_target="https://\$host:$https_port\$request_uri"
  fi

  cat > "$conf" <<NGINX
# Generated by install.sh — web deployment for $domain
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name $domain;

    # Let's Encrypt webroot challenge.
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
NGINX

  if [ "$ssl_active" = "1" ]; then
    cat >> "$conf" <<NGINX

    # Redirect all other HTTP traffic to HTTPS.
    location / {
        return 301 $https_target;
    }
}

server {
    listen $https_port ssl;
    listen [::]:$https_port ssl;
    http2 on;
    server_name $domain;

    ssl_certificate     $cert_path;
    ssl_certificate_key $key_path;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:P00SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout 5s;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 50m;

    location / {
        proxy_pass http://$app_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host  \$host;
        proxy_set_header Upgrade    \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }
}
NGINX
  else
    # SSL not active yet (initial LE bootstrap): proxy everything over HTTP
    # so the site is reachable while certbot issues the first certificate.
    cat >> "$conf" <<NGINX

    location / {
        proxy_pass http://$app_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade    \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
    }
}
NGINX
  fi
}

# Generate docker-compose.web.yml.
# Args: domain https_port ssl_mode le_email cert_host_path key_host_path
write_web_compose_file() {
  local domain="$1" https_port="$2" ssl_mode="$3" le_email="$4" cert_host_path="$5" key_host_path="$6"
  local state
  state="$(state_dir)"
  mkdir -p "$state/web-db" "$state/web-logs"

  local certbot_block=""
  if [ "$ssl_mode" = "le" ]; then
    certbot_block=$(cat <<CB
  certbot:
    image: certbot/certbot
    container_name: ${CONTAINER_NAME}-certbot
    restart: unless-stopped
    entrypoint: /entrypoint.sh
    environment:
      DOMAINS: "$domain"
      EMAIL: "$le_email"
    volumes:
      - webroot:/var/www/certbot
      - certs:/etc/letsencrypt
      - $SCRIPT_DIR/docker/certbot/entrypoint.sh:/entrypoint.sh:ro
    networks:
      - webnet
CB
)
  fi

  local nginx_volumes
  if [ "$ssl_mode" = "le" ]; then
    nginx_volumes=$(cat <<NV
      - $WEB_NGINX_DIR:/etc/nginx/conf.d:ro
      - $SCRIPT_DIR/docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - webroot:/var/www/certbot
      - certs:/etc/letsencrypt:ro
NV
)
  elif [ "$ssl_mode" = "existing" ] || [ "$ssl_mode" = "cf-origin" ] || [ "$ssl_mode" = "self-signed" ]; then
    nginx_volumes=$(cat <<NV
      - $WEB_NGINX_DIR:/etc/nginx/conf.d:ro
      - $SCRIPT_DIR/docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - $cert_host_path:/etc/ssl/custom/fullchain.pem:ro
      - $key_host_path:/etc/ssl/custom/privkey.pem:ro
NV
)
  else
    nginx_volumes=$(cat <<NV
      - $WEB_NGINX_DIR:/etc/nginx/conf.d:ro
      - $SCRIPT_DIR/docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
NV
)
  fi

  cat > "$WEB_COMPOSE_FILE" <<YAML
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: $IMAGE_NAME
    container_name: ${CONTAINER_NAME}-web-app
    restart: unless-stopped
    env_file:
      - .env
    environment:
      NODE_ENV: production
      NEXT_TELEMETRY_DISABLED: "1"
      HIDE_NEXT_DEV_INDICATOR: "1"
      HOSTNAME: 0.0.0.0
      PORT: "3000"
      DATABASE_URL: file:/app/db/custom.db
    expose:
      - "3000"
    volumes:
      - web-db:/app/db
      - $state/web-logs:/app/logs
    init: true
    cpus: "\${P00RIJA_CPUS:-0}"
    mem_limit: "\${P00RIJA_MEMORY_LIMIT:-0}"
    pids_limit: 256
    stop_grace_period: 20s
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 20s
      timeout: 5s
      retries: 5
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - webnet

  nginx:
    image: nginx:alpine
    container_name: ${CONTAINER_NAME}-web-nginx
    restart: unless-stopped
    entrypoint: /nginx-entrypoint.sh
    ports:
      - "80:80"
      - "${https_port}:${https_port}"
    volumes:
$nginx_volumes
      - $SCRIPT_DIR/docker/nginx/entrypoint.sh:/nginx-entrypoint.sh:ro
    depends_on:
      app:
        condition: service_healthy
    networks:
      - webnet

$certbot_block

networks:
  webnet:
    driver: bridge

volumes:
  web-db:
  webroot:
  certs:
YAML
}

# Interactive: gather web deployment parameters.
ask_web_params() {
  local domain https_port ssl_mode le_email cert_path key_path behind_cf

  if [ -n "${P00RIJA_DOMAIN:-}" ]; then
    domain="$P00RIJA_DOMAIN"
    https_port="${P00RIJA_PUBLIC_PORT:-443}"
    ssl_mode="${P00RIJA_SSL_MODE:-le}"
    le_email="${P00RIJA_LE_EMAIL:-admin@$domain}"
    cert_path="${P00RIJA_CERT_PATH:-}"
    key_path="${P00RIJA_KEY_PATH:-}"
    behind_cf="${P00RIJA_BEHIND_CLOUDFLARE:-0}"
    validate_port "$https_port" || die "Invalid HTTPS port: $https_port"
    [ "$https_port" != "80" ] || die "HTTPS port cannot be 80."
    case "$ssl_mode" in
      le)
        validate_public_domain "$domain" || die "Let's Encrypt requires a valid public domain."
        check_domain_dns "$domain"
        ;;
      self-signed) ;;
      existing|cf-origin)
        [ -f "$cert_path" ] || die "Certificate file not found: $cert_path"
        [ -f "$key_path" ] || die "Private key file not found: $key_path"
        ;;
      *) die "Invalid P00RIJA_SSL_MODE: $ssl_mode" ;;
    esac
    printf '%s|%s|%s|%s|%s|%s|%s' "$domain" "$https_port" "$ssl_mode" "$le_email" "$cert_path" "$key_path" "$behind_cf"
    return
  fi

  echo
  note "Web deployment: Docker + Nginx + SSL"
  echo "  The app runs in a container on an internal network; nginx terminates"
  echo "  SSL and reverse-proxies to it. Everything runs inside Docker."

  echo
  if ask_yes_no "Will this be behind Cloudflare CDN" "n"; then
    behind_cf=1
    echo "  Cloudflare allows HTTPS origin connections on these ports:"
    echo "    ${CF_HTTPS_PORTS// /, }"
    https_port="$(ask "HTTPS port (Cloudflare origin)" "443")"
    if ! is_cloudflare_port "$https_port"; then
      warn "$https_port is not in the Cloudflare-allowed list ($CF_HTTPS_PORTS)."
      ask_yes_no "Use this port anyway (direct access, not via CDN)" "n" || die "Aborted."
    fi
  else
    behind_cf=0
    https_port="$(ask "HTTPS port" "443")"
    validate_port "$https_port" || die "Invalid HTTPS port: $https_port"
  fi
  [ "$https_port" != "80" ] || die "HTTPS port cannot be 80 (reserved for HTTP→HTTPS redirect)."

  domain="$(ask "Domain (e.g. portfolio.example.com)" "")"
  [ -n "$domain" ] || die "A domain is required."

  echo
  echo "SSL mode:"
  echo "  1) Let's Encrypt (free, auto-renewing — requires the domain to point here)"
  echo "  2) Use existing certificate files"
  echo "  3) Cloudflare Origin CA certificate (for Full Strict mode behind CF)"
  echo "  4) Self-signed (browser warnings — local/testing only)"
  ssl_mode="$(ask "Choose SSL mode" "1")"
  case "$ssl_mode" in
    1)
      if [[ "$domain" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [ "$domain" = "localhost" ] || [ "$domain" = "127.0.0.1" ]; then
        die "Let's Encrypt needs a real public domain, not localhost or an IP."
      fi
      validate_public_domain "$domain" || die "Invalid public domain: $domain"
      check_domain_dns "$domain"
      le_email="$(ask "Let's Encrypt notification email" "admin@$domain")"
      ssl_mode="le"
      ;;
    2)
      cert_path="$(ask "Path to fullchain/certificate" "")"
      key_path="$(ask "Path to private key" "")"
      [ -f "$cert_path" ] || die "Certificate file not found: $cert_path"
      [ -f "$key_path" ] || die "Private key file not found: $key_path"
      ssl_mode="existing"
      ;;
    3)
      echo "  Paste your Cloudflare Origin CA certificate and key paths below."
      echo "  Generate one at: Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate"
      cert_path="$(ask "Path to Origin CA cert (fullchain.pem)" "")"
      key_path="$(ask "Path to Origin CA key (privkey.pem)" "")"
      [ -f "$cert_path" ] || die "Certificate file not found: $cert_path"
      [ -f "$key_path" ] || die "Private key file not found: $key_path"
      ssl_mode="cf-origin"
      ;;
    4)
      warn "Self-signed certs cause browser warnings and are not trusted by Cloudflare Full (strict)."
      ssl_mode="self-signed"
      ;;
    *) die "Invalid SSL mode." ;;
  esac

  printf '%s|%s|%s|%s|%s|%s|%s' "$domain" "$https_port" "$ssl_mode" "${le_email:-}" "${cert_path:-}" "${key_path:-}" "$behind_cf"
}

install_web() {
  require_root
  ensure_docker
  ensure_web_prerequisites
  ensure_low_memory_swap

  local domain https_port ssl_mode le_email cert_path key_path behind_cf
  IFS='|' read -r domain https_port ssl_mode le_email cert_path key_path behind_cf <<<"$(ask_web_params)"

  local hide_indicator=1
  write_env "3000" "$hide_indicator"
  configure_adaptive_container_resources

  # Determine the cert paths that nginx will use INSIDE the container.
  local nginx_cert nginx_key ssl_active
  case "$ssl_mode" in
    le) # Let's Encrypt — certs land in the shared volume at the standard path.
      nginx_cert="/etc/letsencrypt/live/$domain/fullchain.pem"
      nginx_key="/etc/letsencrypt/live/$domain/privkey.pem"
      ssl_active=0  # bootstrap: serve HTTP first so certbot can issue
      ;;
    existing|cf-origin) # Existing / CF Origin CA — mounted at fixed paths.
      nginx_cert="/etc/ssl/custom/fullchain.pem"
      nginx_key="/etc/ssl/custom/privkey.pem"
      ssl_active=1
      ;;
    self-signed) # Self-signed — generate into a host dir and mount it.
      local cert_dir ssl_out
      cert_dir="$(state_dir)/ssl"
      mkdir -p "$cert_dir"
      ssl_out="$(make_self_signed_cert "$domain" "$cert_dir")"
      cert_path="${ssl_out%%|*}"
      key_path="${ssl_out##*|}"
      nginx_cert="/etc/ssl/custom/fullchain.pem"
      nginx_key="/etc/ssl/custom/privkey.pem"
      ssl_active=1
      ;;
  esac

  mkdir -p "$WEB_NGINX_DIR"

  # Stage 1: write the compose file and the HTTP-only nginx config, then start.
  write_web_compose_file "$domain" "$https_port" "$ssl_mode" "$le_email" "$cert_path" "$key_path"
  write_nginx_web_conf "$domain" "$https_port" "app:3000" "$nginx_cert" "$nginx_key" "$ssl_active"

  note "Building and starting containers (this may take a few minutes)..."
  build_web_image_adaptively
  if [ "$ssl_mode" = "le" ]; then
    docker_compose -f "$WEB_COMPOSE_FILE" up -d --no-build app nginx
  else
    docker_compose -f "$WEB_COMPOSE_FILE" up -d --no-build
  fi

  if [ "$ssl_mode" = "le" ]; then
    note "Requesting Let's Encrypt certificate for $domain..."
    # Run a one-shot certbot issuance via the webroot challenge.
    docker_compose -f "$WEB_COMPOSE_FILE" run --rm --entrypoint certbot certbot \
      certonly --webroot -w /var/www/certbot -d "$domain" \
      --email "$le_email" --no-eff-email --agree-tos \
      --non-interactive --key-type rsa --rsa-key-size 2048 \
      || die "certbot failed. Check DNS for $domain and that port 80 is open."

    # Stage 2: switch nginx to the full HTTPS config and reload.
    write_nginx_web_conf "$domain" "$https_port" "app:3000" "$nginx_cert" "$nginx_key" 1
    docker_compose -f "$WEB_COMPOSE_FILE" exec nginx nginx -s reload 2>/dev/null \
      || docker_compose -f "$WEB_COMPOSE_FILE" restart nginx
    docker_compose -f "$WEB_COMPOSE_FILE" up -d certbot
  fi

  echo
  bold "Web deployment complete"
  if [ "$ssl_active" = "1" ] || [ "$ssl_mode" = "le" ]; then
    if [ "$https_port" = "443" ]; then
      note "URL: https://$domain"
    else
      note "URL: https://$domain:$https_port"
    fi
  else
    note "URL: http://$domain"
  fi
  note "Compose: $WEB_COMPOSE_FILE"
  note "Logs:    docker compose -f $WEB_COMPOSE_FILE logs -f"
  if [ "$behind_cf" = "1" ]; then
    echo
    note "Cloudflare setup reminder:"
    echo "    • DNS: create an A record for $domain → this server's public IP."
    echo "    • SSL/TLS mode: set to 'Full (strict)' if using an Origin CA cert,"
    echo "      or 'Full' for Let's Encrypt."
    echo "    • Origin port $https_port is reachable by Cloudflare."
  fi
}

update_web() {
  require_root
  ensure_docker
  [ -f "$WEB_COMPOSE_FILE" ] || die "No web deployment found. Run option 10 first."
  if [ -d .git ]; then
    if ask_yes_no "Run git pull before rebuild" "n"; then git pull --ff-only; fi
  fi
  note "Rebuilding and restarting web containers..."
  docker_compose -f "$WEB_COMPOSE_FILE" up -d --build
  note "Web deployment updated."
}

reset_web() {
  require_root
  ensure_docker
  [ -f "$WEB_COMPOSE_FILE" ] || die "No web deployment found. Run option 10 first."
  warn "This resets the app database volume. Containers, certs, and nginx config are kept."
  ask_yes_no "Continue with web reset" "n" || return
  docker_compose -f "$WEB_COMPOSE_FILE" stop app 2>/dev/null || true
  docker volume rm "${APP_NAME}_web-db" 2>/dev/null || docker volume rm "${CONTAINER_NAME}_web-db" 2>/dev/null || warn "Could not remove web-db volume (it may use a different name)."
  docker_compose -f "$WEB_COMPOSE_FILE" up -d
  note "Web app database reset complete."
}

uninstall_web() {
  require_root
  ensure_docker
  warn "This stops and removes all web containers, volumes, and the compose file."
  ask_yes_no "Continue uninstall web deployment" "n" || return
  if [ -f "$WEB_COMPOSE_FILE" ]; then
    docker_compose -f "$WEB_COMPOSE_FILE" down --remove-orphans -v || true
  fi
  docker rm -f "${CONTAINER_NAME}-web-app" "${CONTAINER_NAME}-web-nginx" "${CONTAINER_NAME}-certbot" 2>/dev/null || true
  if ask_yes_no "Delete SSL certs and generated nginx config too" "n"; then
    rm -f "$WEB_COMPOSE_FILE"
    rm -f "$WEB_NGINX_DIR/default.conf"
    rm -rf "$(state_dir)/ssl" "$(state_dir)/web-db" "$(state_dir)/web-logs"
  fi
  note "Web deployment uninstalled."
}

build_clean_package() {
  note "Building the clean GitHub package / Docker Hub image..."
  local args=(--image)
  [ -t 0 ] || args+=(--no-archive)
  bash "$SCRIPT_DIR/scripts/make-clean-package.sh" "${args[@]}"
}

status_all() {
  bold "P00RIJA Portfolio status"  echo
  echo "Native service:"
  case "$(service_kind)" in
    launchd)
      launchctl print "system/$LAUNCHD_LABEL" 2>/dev/null | sed -n '1,90p' || echo "launchd service is not loaded."
      ;;
    systemd)
      systemctl --no-pager --full status "$APP_NAME" 2>/dev/null || true
      ;;
    *)
      echo "No supported native service manager found."
      ;;
  esac
  echo
  echo "Docker (localhost install):"
  docker ps -a --filter "name=$CONTAINER_NAME" 2>/dev/null || true
  echo
  echo "Docker (web deployment):"
  if [ -f "$WEB_COMPOSE_FILE" ]; then
    docker_compose -f "$WEB_COMPOSE_FILE" ps 2>/dev/null || echo "Compose file present but not running."
    echo
    echo "Web nginx config ($WEB_NGINX_DIR/default.conf):"
    [ -f "$WEB_NGINX_DIR/default.conf" ] && sed -n '1,200p' "$WEB_NGINX_DIR/default.conf" || echo "Not generated yet."
  else
    echo "No web deployment (docker-compose.web.yml not found)."
  fi
  echo
  echo "Host Nginx config:"
  local conf
  conf="$(nginx_conf_path)"
  [ -f "$conf" ] && sed -n '1,220p' "$conf" || echo "No host Nginx config found for $APP_NAME"
}

menu() {
  show_banner
  while true; do
    echo
    bold "P00RIJA Portfolio Installer / Control Center"
    echo "  1) Install native localhost/server"
    echo "  2) Install Docker localhost/server"
    echo "  3) Update native install"
    echo "  4) Update Docker install"
    echo "  5) Reset native app/database"
    echo "  6) Reset Docker app/database"
    echo "  7) Uninstall native install"
    echo "  8) Uninstall Docker install"
    echo "  9) Show status"
    echo " 10) Deploy web (Docker + Nginx + SSL)  ★"
    echo " 11) Update web deployment"
    echo " 12) Reset web deployment"
    echo " 13) Uninstall web deployment"
    echo " 14) Build clean package + image (GitHub / Docker Hub)"
    echo "  0) Exit"
    case "$(ask "Choose action" "1")" in
      1) install_local; pause ;;
      2) install_docker; pause ;;
      3) update_local; pause ;;
      4) update_docker; pause ;;
      5) reset_local; pause ;;
      6) reset_docker; pause ;;
      7) uninstall_local; pause ;;
      8) uninstall_docker; pause ;;
      9) status_all; pause ;;
      10) install_web; pause ;;
      11) update_web; pause ;;
      12) reset_web; pause ;;
      13) uninstall_web; pause ;;
      14) build_clean_package; pause ;;
      0) exit 0 ;;
      *) warn "Invalid option." ;;
    esac
  done
}

if [ "${BASH_SOURCE[0]}" != "$0" ]; then
  return 0
fi

case "${1:-}" in
  --local) install_local ;;
  --docker) install_docker ;;
  --update) update_local ;;
  --update-docker) update_docker ;;
  --reset) reset_local ;;
  --reset-docker) reset_docker ;;
  --uninstall) uninstall_local ;;
  --uninstall-docker) uninstall_docker ;;
  --status) status_all ;;
  --web) install_web ;;
  --web-auto) [ -n "${P00RIJA_DOMAIN:-}" ] || die "P00RIJA_DOMAIN is required for --web-auto"; install_web ;;
  --update-web) update_web ;;
  --reset-web) reset_web ;;
  --uninstall-web) uninstall_web ;;
  --package) build_clean_package ;;
  --help|-h)
    cat <<HELP
Usage: sudo bash install.sh [action]

Actions:
  --local             Install native localhost/server service
  --docker            Install Docker localhost/server container
  --update            Update native install
  --update-docker     Update Docker install
  --reset             Reset local database/app state
  --reset-docker      Reset Docker container and database data
  --uninstall         Remove native service/Nginx install
  --uninstall-docker  Remove Docker install
  --status            Show status
  --web               Deploy web (Docker + Nginx + SSL) multi-container
  --web-auto          Non-interactive web deploy using P00RIJA_DOMAIN and related environment variables
  --update-web        Update web deployment (rebuild + restart)
  --reset-web         Reset web app database volume
  --uninstall-web     Remove web deployment (containers + volumes)
  --package           Build the clean GitHub package + clean Docker image
  --banner            Show the animated ASCII banner

Without an action, an interactive control menu opens.
HELP
    ;;
  --banner) show_banner ;;
  "") menu ;;
  *) die "Unknown action: $1. Use --help." ;;
esac
