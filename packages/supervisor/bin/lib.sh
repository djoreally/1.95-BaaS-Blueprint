#!/usr/bin/env bash
# lib.sh — shared helpers for the baas supervisor kit. Source this, don't execute it.
#   . "$SCRIPT_DIR/lib.sh" && load_config
# Portable: bash + curl + flock expected; sqlite3 optional. No jq needed.
# Every consumer runs under `set -euo pipefail`; keep every helper safe under it.

[ -n "${_BAAS_LIB_LOADED:-}" ] && return 0
_BAAS_LIB_LOADED=1

# --- layout -----------------------------------------------------------------
# BAAS_DIR is the one environment knob (tests point it at a tmp dir).
baas_dir()      { echo "${BAAS_DIR:-$HOME/baas}"; }
bin_dir()       { echo "$(baas_dir)/bin"; }
registry_file() { echo "$(baas_dir)/registry/ports.registry"; }
watchdog_log()  { echo "$(baas_dir)/logs/watchdog.log"; }
config_file()   { echo "$(baas_dir)/baas.conf"; }

# --- config -----------------------------------------------------------------
# Built-in defaults; $BAAS_DIR/baas.conf overrides them (see templates/baas.conf).
PORT_RANGE_START=18000
PORT_RANGE_END=18999
HEALTH_TIMEOUT_S=5
LOG_KEEP_LINES=1000
STOP_GRACE_S=10

load_config() {
  local cfg
  cfg="$(config_file)"
  if [ -f "$cfg" ]; then
    # shellcheck disable=SC1090
    . "$cfg"
  fi
}

# --- logging ----------------------------------------------------------------
log_msg() { # log_msg <message> [logfile]
  local msg="$1" logfile="${2:-$(watchdog_log)}"
  mkdir -p "$(dirname "$logfile")"
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$msg" >>"$logfile"
}

# Keep the last ~$keep lines of a log; only rewrites when it has grown past
# keep+100 so a 2-minute cron isn't constantly rewriting the file.
rotate_log() { # rotate_log <file> [keep]
  local file="$1" keep="${2:-$LOG_KEEP_LINES}" lines
  [ -f "$file" ] || return 0
  lines=$(wc -l <"$file")
  if [ "$lines" -gt $((keep + 100)) ]; then
    tail -n "$keep" "$file" >"$file.tmp" && mv "$file.tmp" "$file"
  fi
}

# --- registry ---------------------------------------------------------------
# TSV: app<TAB>port<TAB>binary<TAB>health_path<TAB>data_dir<TAB>pidfile<TAB>extra_args
# binary/data_dir/pidfile are relative to BAAS_DIR. Lines starting with '#'
# and blank lines are ignored.
registry_rows() {
  local reg
  reg="$(registry_file)"
  [ -f "$reg" ] || return 0
  grep -v '^[[:space:]]*#' "$reg" | grep -v '^[[:space:]]*$' || true
}

# get_app_field <app> <col> — 1-based TSV column, empty when the app is unknown.
get_app_field() {
  local app="$1" col="$2"
  registry_rows | awk -F'\t' -v app="$app" -v col="$col" '$1 == app { print $col; exit }'
}

valid_app_name() { [[ "${1:-}" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; }

# Run "$@" with an exclusive lock on the registry (allocation / free).
with_registry_lock() {
  local lockfile
  lockfile="$(registry_file).lock"
  mkdir -p "$(dirname "$lockfile")"
  (
    flock -x 200 || exit 1
    "$@"
  ) 200>"$lockfile"
}

# --- process safety ---------------------------------------------------------
# is_our_process <pid> <binary-basename>
# True ONLY if the pid is alive AND its command line mentions our binary.
# This is the "never kill anything it didn't start" guard: PIDs get recycled,
# pidfiles go stale — the cmdline check is what keeps us from signalling a
# stranger. /proc may be restricted under CageFS; then we fall back to kill -0.
is_our_process() {
  local pid="$1" want="$2" cmdline
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  cmdline="/proc/$pid/cmdline"
  if [ -r "$cmdline" ]; then
    tr '\0' ' ' <"$cmdline" | grep -qF "$want" || return 1
  fi
  return 0
}

# --- health -----------------------------------------------------------------
http_health() { # http_health <port> [path]
  local port="$1" path="${2:-/api/health}"
  curl -fsS --max-time "$HEALTH_TIMEOUT_S" -o /dev/null \
    "http://127.0.0.1:${port}${path}" 2>/dev/null
}
