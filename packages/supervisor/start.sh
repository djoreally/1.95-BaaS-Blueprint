#!/usr/bin/env bash
# start.sh — boot one project binary. Usage: start.sh <project> <port> [binary]
# Deploys to ~/apps/<project>/: binary + pb_data/ + logs/. Idempotent.
set -euo pipefail

PROJECT="${1:?usage: start.sh <project> <port> [binary]}"
PORT="${2:?usage: start.sh <project> <port> [binary]}"
BINARY="${3:-pocketbase}"

APP_DIR="$HOME/apps/$PROJECT"
PID_FILE="$APP_DIR/app.pid"
LOG_DIR="$APP_DIR/logs"
DATA_DIR="$APP_DIR/pb_data"

mkdir -p "$APP_DIR" "$LOG_DIR" "$DATA_DIR"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "$PROJECT already running (pid $(cat "$PID_FILE"))"
  exit 0
fi

cd "$APP_DIR"
# Loopback only — Apache is the only ingress (see htaccess-proxy.sample).
nohup "./$BINARY" serve \
  --http="127.0.0.1:$PORT" \
  --dir="$DATA_DIR" \
  >>"$LOG_DIR/app.log" 2>&1 &
echo $! > "$PID_FILE"
echo "started $PROJECT on 127.0.0.1:$PORT (pid $(cat "$PID_FILE"))"
