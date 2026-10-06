#!/usr/bin/env bash
# start.sh <app> — idempotent launcher for one project binary.
# Reads everything from the registry; never invents paths. Safe to run
# repeatedly: exits 0 immediately if the app is already running.
#
# Assumes the PocketBase convention: <binary> serve --http=127.0.0.1:PORT
# --dir=DATA_DIR [extra_args]. Loopback only — Apache is the sole ingress.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"
load_config

APP="${1:?usage: start.sh <app>}"
valid_app_name "$APP" || {
  echo "error: invalid app name '$APP'" >&2
  exit 1
}

BAAS="$(baas_dir)"
port="$(get_app_field "$APP" 2 || true)"
binary="$(get_app_field "$APP" 3 || true)"
data_dir="$(get_app_field "$APP" 5 || true)"
pidfile="$(get_app_field "$APP" 6 || true)"
extra_args="$(get_app_field "$APP" 7 || true)"

if [ -z "$port" ] || [ -z "$binary" ]; then
  echo "error: app '$APP' not in registry (ports.sh alloc first)" >&2
  exit 1
fi

BIN="$BAAS/$binary"
APP_HOME="$(dirname "$BIN")"
DATA="$BAAS/$data_dir"
PIDF="$BAAS/$pidfile"
want="$(basename "$binary")"

# Idempotent: already ours and alive -> nothing to do.
if [ -f "$PIDF" ]; then
  pid="$(cat "$PIDF" 2>/dev/null || true)"
  if [ -n "$pid" ] && is_our_process "$pid" "$want"; then
    echo "$APP already running (pid $pid)"
    exit 0
  fi
  echo "$APP: stale pidfile (pid '${pid:-?}'), removing"
  rm -f "$PIDF"
fi

[ -x "$BIN" ] || {
  echo "error: binary not executable: $BIN" >&2
  exit 1
}
mkdir -p "$APP_HOME" "$DATA" "$APP_HOME/logs"

cd "$APP_HOME"
# Detached, loopback-only, stdout/stderr to the app log.
# shellcheck disable=SC2086
nohup "$BIN" serve --http="127.0.0.1:$port" --dir="$DATA" ${extra_args:-} \
  >>"$APP_HOME/logs/app.log" 2>&1 &
npid=$!
echo "$npid" >"$PIDF"

sleep 1
if is_our_process "$npid" "$want"; then
  log_msg "[$APP] started on 127.0.0.1:$port (pid $npid)" "$APP_HOME/logs/start.log"
  echo "started $APP on 127.0.0.1:$port (pid $npid)"
else
  rm -f "$PIDF"
  echo "error: $APP failed to start — see $APP_HOME/logs/app.log" >&2
  exit 1
fi
