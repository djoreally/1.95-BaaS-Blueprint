#!/usr/bin/env bash
# stop.sh — graceful stop of one project binary. Usage: stop.sh <project>
set -euo pipefail

PROJECT="${1:?usage: stop.sh <project>}"
APP_DIR="$HOME/apps/$PROJECT"
PID_FILE="$APP_DIR/app.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "$PROJECT not running (no pidfile)"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  # give it 10s to flush (SQLite WAL checkpoint on shutdown matters)
  for _ in $(seq 1 10); do
    kill -0 "$PID" 2>/dev/null || break
    sleep 1
  done
  kill -9 "$PID" 2>/dev/null || true
  echo "stopped $PROJECT (pid $PID)"
else
  echo "$PROJECT pidfile stale (pid $PID not alive)"
fi
rm -f "$PID_FILE"
