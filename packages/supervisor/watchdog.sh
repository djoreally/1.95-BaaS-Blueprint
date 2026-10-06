#!/usr/bin/env bash
# watchdog.sh — the systemd substitute. Install via cron every 5 minutes:
#   */5 * * * * $HOME/apps/<project>/watchdog.sh >> $HOME/apps/<project>/logs/watchdog.log 2>&1
# Per project: checks pidfile + TCP health, restarts via start.sh if down.
# Also runs nightly SQLite hygiene (WAL checkpoint + vacuum) once per day.
set -euo pipefail

PROJECT="$(basename "$(dirname "$0")")"
APP_DIR="$HOME/apps/$PROJECT"
PID_FILE="$APP_DIR/app.pid"
LOG_DIR="$APP_DIR/logs"
DATA_DIR="$APP_DIR/pb_data"
PORT_FILE="$APP_DIR/port"

mkdir -p "$LOG_DIR"
PORT="$(cat "$PORT_FILE" 2>/dev/null || echo "")"
[ -n "$PORT" ] || { echo "$(date -Is) [$PROJECT] no port file ($APP_DIR/port) — cannot health-check"; exit 1; }

alive=0
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  # TCP-level health check on the loopback port
  if (echo > /dev/tcp/127.0.0.1/"$PORT") 2>/dev/null; then
    alive=1
  fi
fi

if [ "$alive" -eq 0 ]; then
  echo "$(date -Is) [$PROJECT] down — restarting on port $PORT"
  rm -f "$PID_FILE"
  "$APP_DIR/start.sh" "$PROJECT" "$PORT" >>"$LOG_DIR/app.log" 2>&1 || \
    echo "$(date -Is) [$PROJECT] restart FAILED"
fi

# Nightly SQLite hygiene: checkpoint WAL + vacuum (keeps the -wal file bounded).
# Runs when the minute of the hour is 0–4 on the 3 AM run only.
if [ "$(date +%H)" = "03" ] && [ -f "$DATA_DIR/data.db" ]; then
  sqlite3 "$DATA_DIR/data.db" "PRAGMA wal_checkpoint(TRUNCATE); VACUUM;" 2>/dev/null \
    && echo "$(date -Is) [$PROJECT] nightly sqlite hygiene ok" || true
fi
