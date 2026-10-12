#!/bin/sh
set -eu

mode="${1:-run}"
shift || true

read_memory_bytes() {
  if [ -r /sys/fs/cgroup/memory.max ]; then
    value=$(cat /sys/fs/cgroup/memory.max)
    [ "$value" != "max" ] && [ "$value" -gt 0 ] 2>/dev/null && { echo "$value"; return; }
  fi
  if [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
    value=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
    [ "$value" -lt 9000000000000000000 ] 2>/dev/null && { echo "$value"; return; }
  fi
  if [ -r /proc/meminfo ]; then
    awk '/MemTotal:/ { printf "%.0f\n", $2 * 1024; exit }' /proc/meminfo
    return
  fi
  sysctl -n hw.memsize 2>/dev/null || echo 1073741824
}

read_cpu_count() {
  if [ -r /sys/fs/cgroup/cpu.max ]; then
    set -- $(cat /sys/fs/cgroup/cpu.max)
    if [ "${1:-max}" != "max" ] && [ "${2:-0}" -gt 0 ] 2>/dev/null; then
      echo $(( ($1 + $2 - 1) / $2 ))
      return
    fi
  fi
  if command -v nproc >/dev/null 2>&1; then nproc; return; fi
  getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1
}

memory_bytes=$(read_memory_bytes)
memory_mb=$((memory_bytes / 1024 / 1024))
cpu_count=$(read_cpu_count)
[ -z "${P00RIJA_MEMORY_MB_OVERRIDE:-}" ] || memory_mb="$P00RIJA_MEMORY_MB_OVERRIDE"
[ -z "${P00RIJA_CPU_COUNT_OVERRIDE:-}" ] || cpu_count="$P00RIJA_CPU_COUNT_OVERRIDE"
[ "$cpu_count" -lt 1 ] && cpu_count=1

if [ "$memory_mb" -le 1536 ] || [ "$cpu_count" -le 1 ]; then
  profile=eco
  heap_mb=$((memory_mb * 52 / 100))
  [ "$heap_mb" -gt 512 ] && heap_mb=512
  [ "$heap_mb" -lt 256 ] && heap_mb=256
elif [ "$memory_mb" -le 4096 ] || [ "$cpu_count" -le 4 ]; then
  profile=balanced
  heap_mb=$((memory_mb * 48 / 100))
  [ "$heap_mb" -gt 1536 ] && heap_mb=1536
else
  profile=performance
  heap_mb=$((memory_mb * 42 / 100))
  [ "$heap_mb" -gt 4096 ] && heap_mb=4096
fi

# Compilation and TypeScript checking need a larger old-space budget than the
# production server. On a 1 GB host, 512 MB is too small for Next.js typecheck;
# one build worker plus a ~70% heap remains bounded and can spill to installer-
# managed swap without making the runtime itself memory-hungry.
if [ "$mode" = "build" ] && [ "$profile" = "eco" ]; then
  heap_mb=$((memory_mb * 70 / 100))
  [ "$heap_mb" -gt 704 ] && heap_mb=704
  [ "$heap_mb" -lt 384 ] && heap_mb=384
fi

build_cpus=$cpu_count
memory_cpus=$((memory_mb / 768))
[ "$memory_cpus" -lt 1 ] && memory_cpus=1
[ "$build_cpus" -gt "$memory_cpus" ] && build_cpus=$memory_cpus
[ "$build_cpus" -gt 8 ] && build_cpus=8

export P00RIJA_RUNTIME_PROFILE="$profile"
export P00RIJA_DETECTED_CPUS="$cpu_count"
export P00RIJA_DETECTED_MEMORY_MB="$memory_mb"
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-$((cpu_count * 2))}"
[ "$UV_THREADPOOL_SIZE" -lt 4 ] && UV_THREADPOOL_SIZE=4
[ "$UV_THREADPOOL_SIZE" -gt 32 ] && UV_THREADPOOL_SIZE=32
export UV_THREADPOOL_SIZE
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=$heap_mb}"

if [ "$mode" = "build" ]; then
  export NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-$build_cpus}"
fi

echo "P00RIJA hardware profile: $profile | CPU=$cpu_count | RAM=${memory_mb}MB | heap=${heap_mb}MB${NEXT_BUILD_CPUS:+ | build_workers=$NEXT_BUILD_CPUS}"
exec "$@"
