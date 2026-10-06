#!/usr/bin/env bash
# stop.sh <app> — graceful stop of one project binary.
# Kills ONLY the PID recorded in the app's pidfile, and only after verifying
# the process is actually ours (cmdline check). A stale or foreign pidfile
# is never acted on blindly.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"
load_config

APP="${1:?usage: stop.sh <app>}"
valid_app_name "$APP" || {
  echo "error: invalid app name '$APP'" >&2
  exit 1
}

BAAS="$(baas_dir)"
binary="$(get_app_field "$APP" 3 || true)"
pidfile="$(get_app_field "$APP" 6 || true)"
PIDF="$BAAS/$pidfile"
want="$(basename "${binary:-pocketbase}")"

if [ ! -f "$PIDF" ]; then
  echo "$APP not running (no pidfile)"
  exit 0
fi

pid="$(cat "$PIDF" 2>/dev/null || true)"
if ! [[ "$pid" =~ ^[0-9]+$ ]]; then
  echo "$APP: pidfile corrupt ('$pid'), removing"
  rm -f "$PIDF"
  exit 0
fi

if is_our_process "$pid" "$want"; then
  kill "$pid" 2>/dev/null || true
  # Grace period so SQLite can checkpoint the WAL on shutdown.
  for _ in $(seq 1 "$STOP_GRACE_S"); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
    echo "killed $APP (pid $pid, SIGKILL after ${STOP_GRACE_S}s grace)"
  else
    echo "stopped $APP (pid $pid)"
  fi
  rm -f "$PIDF"
elif kill -0 "$pid" 2>/dev/null; then
  # Alive, but NOT our binary (recycled PID, or someone else's process).
  # Refuse: killing it would violate the supervisor's core guarantee.
  echo "error: pid $pid is alive but is not our '$want' — refusing to kill; pidfile left in place" >&2
  exit 1
else
  echo "$APP pidfile stale (pid $pid not alive), removing"
  rm -f "$PIDF"
fi
