#!/usr/bin/env bash
# watchdog.sh — the systemd substitute. One cron line supervises every app:
#   */2 * * * * $HOME/baas/bin/watchdog.sh >> $HOME/baas/logs/watchdog.log 2>&1
#
# For each row in the registry: if the pidfile's process is alive AND the
# health endpoint answers, do nothing. Otherwise restart via stop.sh/start.sh.
# Never kills anything it didn't start (pidfile + cmdline check in lib.sh).
# Appends to a rotating log (last ~$LOG_KEEP_LINES lines).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"
load_config

BAAS="$(baas_dir)"
LOG="$(watchdog_log)"
mkdir -p "$(dirname "$LOG")" "$BAAS/apps"

# Single-instance guard: a slow run must not stack up behind cron.
exec {WDLOCK_FD}>"$BAAS/logs/watchdog.lock"
if ! flock -n "$WDLOCK_FD"; then
  exit 0 # another run is still working; cron will try again in 2 minutes
fi

restart_app() { # restart_app <app> <reason>
  local app="$1" reason="$2"
  log_msg "[$app] $reason — restarting" "$LOG"
  "$SCRIPT_DIR/stop.sh" "$app" >>"$LOG" 2>&1 || true
  if "$SCRIPT_DIR/start.sh" "$app" >>"$LOG" 2>&1; then
    log_msg "[$app] restart ok" "$LOG"
  else
    log_msg "[$app] restart FAILED" "$LOG"
  fi
}

check_app() { # check_app <app> <port> <binary> <health> <pidfile-rel>
  local app="$1" port="$2" binary="$3" health="$4" pidfile_rel="$5"
  local want pidfile pid
  want="$(basename "$binary")"
  pidfile="$BAAS/$pidfile_rel"
  pid=""
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile" 2>/dev/null || true)"
  fi

  if [ -n "$pid" ] && is_our_process "$pid" "$want"; then
    if http_health "$port" "${health:-/api/health}"; then
      return 0 # healthy — the common case, stay quiet
    fi
    restart_app "$app" "process alive (pid $pid) but health check failed on :$port${health:-/api/health}"
    return 0
  fi

  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    # Pidfile points at a LIVE process that is not ours (recycled PID).
    # Do not touch it; do not start a second instance on the same port.
    log_msg "[$app] pidfile holds foreign live pid $pid — skipping (manual cleanup needed)" "$LOG"
    return 0
  fi

  if [ -n "$pid" ]; then
    restart_app "$app" "process dead (stale pid $pid)"
  else
    restart_app "$app" "not running (no pidfile)"
  fi
}

# --- main -------------------------------------------------------------------
while IFS=$'\t' read -r app port binary health _data_dir pidfile _extra; do
  [ -n "${app:-}" ] || continue
  [ -n "${port:-}" ] && [ -n "${binary:-}" ] && [ -n "${pidfile:-}" ] || {
    log_msg "[$app] registry row incomplete — skipping" "$LOG"
    continue
  }
  check_app "$app" "$port" "$binary" "$health" "$pidfile"
done < <(registry_rows)

# --- nightly SQLite hygiene ---------------------------------------------------
# Checkpoint the WAL and vacuum each project's data.db once a day (3 AM run).
# Keeps the -wal file bounded on tiny disks. Best-effort: never fails the run.
if [ "$(date +%H)" = "03" ] && command -v sqlite3 >/dev/null 2>&1; then
  while IFS=$'\t' read -r app _port _bin _health data_dir _pid _extra; do
    [ -n "${app:-}" ] || continue
    db="$BAAS/$data_dir/data.db"
    if [ -f "$db" ]; then
      if sqlite3 "$db" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null; then
        log_msg "[$app] wal checkpoint ok" "$LOG"
      fi
      if sqlite3 "$db" "VACUUM;" 2>/dev/null; then
        log_msg "[$app] vacuum ok" "$LOG"
      fi
    fi
  done < <(registry_rows)
fi

rotate_log "$LOG"
