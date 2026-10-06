#!/usr/bin/env bash
# test/run.sh — supervisor test harness.
# Exercises the port allocator, registry read/write, htaccess generator,
# pidfile safety, and the watchdog restart path — all inside a throwaway
# BAAS_DIR under /tmp. No live PocketBase, no cron, no network listeners
# left behind (one controlled `sleep` is used for the foreign-PID test and
# is always cleaned up).
set -euo pipefail

REPO_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)"
TDIR="$(mktemp -d)"
export BAAS_DIR="$TDIR/baas"
BIN="$BAAS_DIR/bin"

PASS=0
FAIL=0
FOREIGN_PID=""

ok() { PASS=$((PASS + 1)); echo "ok   - $*"; }
bad() {
  FAIL=$((FAIL + 1))
  echo "FAIL - $*"
}
assert_eq() { # assert_eq <label> <expected> <actual>
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected '$2', got '$3')"; fi
}
assert_contains() { # assert_contains <label> <needle> <file>
  if grep -qF "$2" "$3"; then ok "$1"; else bad "$1 (missing '$2' in $3)"; fi
}
assert_exit() { # assert_exit <label> <expected-code> <command...>
  local label="$1" want="$2"
  shift 2
  local got
  set +e
  "$@" >/dev/null 2>&1
  got=$?
  set -e
  if [ "$got" = "$want" ]; then ok "$label"; else bad "$label (expected exit $want, got $got)"; fi
}

cleanup() {
  if [ -n "$FOREIGN_PID" ] && kill -0 "$FOREIGN_PID" 2>/dev/null; then
    kill -9 "$FOREIGN_PID" 2>/dev/null || true
  fi
  rm -rf "$TDIR"
}
trap cleanup EXIT

echo "== install =="
"$REPO_BIN/install.sh" --no-cron >/dev/null
[ -d "$BAAS_DIR/apps" ] && [ -d "$BAAS_DIR/registry" ] && [ -d "$BAAS_DIR/logs" ] && [ -x "$BIN/watchdog.sh" ] \
  && ok "install.sh creates layout + installs scripts" || bad "install.sh layout"
[ -f "$BAAS_DIR/registry/ports.registry" ] && [ -f "$BAAS_DIR/baas.conf" ] \
  && ok "install.sh seeds registry + config" || bad "install.sh seeds"

echo "== allocator =="
p1="$("$BIN/ports.sh" alloc alpha)"
assert_eq "first alloc gets range start" "18000" "$p1"
assert_eq "alloc is idempotent" "18000" "$("$BIN/ports.sh" alloc alpha)"
p2="$("$BIN/ports.sh" alloc beta)"
assert_eq "second alloc increments" "18001" "$p2"
assert_eq "get port field" "18001" "$("$BIN/ports.sh" get beta port)"
assert_eq "get binary default" "apps/beta/pocketbase" "$("$BIN/ports.sh" get beta binary)"
assert_exit "invalid app name rejected" 1 "$BIN/ports.sh" alloc "Bad_Name!"
assert_exit "unknown app get fails" 1 "$BIN/ports.sh" get nosuchapp port
"$BIN/ports.sh" free alpha >/dev/null
p3="$("$BIN/ports.sh" alloc gamma)"
assert_eq "freed port is reused" "18000" "$p3"
"$BIN/ports.sh" list | grep -q "beta" && ok "list shows allocations" || bad "list shows allocations"
[ "$("$BIN/ports.sh" alloc delta apps/delta/custom /ping)" = "18002" ] \
  && ok "alloc with custom binary + health path" || bad "alloc with custom binary + health path"
assert_eq "custom health path stored" "/ping" "$("$BIN/ports.sh" get delta health_path)"

echo "== htaccess generator =="
"$BIN/htaccess-gen.sh" acme.example.com 18001 >"$TDIR/ht"
assert_contains "htaccess has port" "127.0.0.1:18001" "$TDIR/ht"
assert_contains "htaccess has P-flag" "[P,L,QSA]" "$TDIR/ht"
assert_contains "htaccess guards host" 'acme\.example\.com' "$TDIR/ht"
"$BIN/htaccess-gen.sh" acme.example.com 18001 --full >"$TDIR/ht-full"
grep -q "REQUEST_URI" "$TDIR/ht-full" && bad "full mode has no selective conditions" || ok "full mode proxies everything"
assert_exit "bad port rejected" 1 "$BIN/htaccess-gen.sh" acme.example.com notaport

echo "== start/stop pidfile handling (no live processes) =="
assert_exit "start unknown app fails" 1 "$BIN/start.sh" nosuchapp
# Stale pidfile: use a PID we know is dead (a reaped background `true`).
true &
dead_pid=$!
wait "$dead_pid" 2>/dev/null || true
mkdir -p "$BAAS_DIR/apps/beta"
echo "$dead_pid" >"$BAAS_DIR/apps/beta/app.pid"
out="$("$BIN/stop.sh" beta 2>&1)"
echo "$out" | grep -q "stale" && [ ! -f "$BAAS_DIR/apps/beta/app.pid" ] \
  && ok "stop.sh clears stale pidfile" || bad "stop.sh clears stale pidfile (got: $out)"
assert_exit "stop without pidfile is a clean no-op" 0 "$BIN/stop.sh" beta

echo "== watchdog: never kills foreign processes =="
# A live `sleep` masquerading as our app via a planted pidfile. The watchdog
# must refuse to touch it.
sleep 120 &
FOREIGN_PID=$!
"$BIN/ports.sh" alloc guard >/dev/null
mkdir -p "$BAAS_DIR/apps/guard"
echo "$FOREIGN_PID" >"$BAAS_DIR/apps/guard/app.pid"
"$BIN/watchdog.sh" >>"$TDIR/wd.log" 2>&1 || true
if kill -0 "$FOREIGN_PID" 2>/dev/null; then
  ok "watchdog left foreign process alone"
else
  bad "watchdog killed a foreign process!"
fi
grep -q "foreign live pid" "$BAAS_DIR/logs/watchdog.log" \
  && ok "watchdog logged the foreign-pid skip" || bad "watchdog logged the foreign-pid skip"
kill -9 "$FOREIGN_PID" 2>/dev/null || true
FOREIGN_PID=""
"$BIN/ports.sh" free guard >/dev/null

echo "== watchdog: restarts dead apps, rotates log =="
"$BIN/ports.sh" alloc flaky >/dev/null
mkdir -p "$BAAS_DIR/apps/flaky"
printf '#!/usr/bin/env bash\nexit 3\n' >"$BAAS_DIR/apps/flaky/pocketbase"
chmod +x "$BAAS_DIR/apps/flaky/pocketbase"
"$BIN/start.sh" flaky >/dev/null 2>&1 || true # binary dies instantly; pidfile goes stale
sleep 2                                        # let the fake process exit
"$BIN/watchdog.sh" >>"$TDIR/wd.log" 2>&1 || true
grep -q "flaky.*restart" "$BAAS_DIR/logs/watchdog.log" \
  && ok "watchdog attempted restart of dead app" || bad "watchdog attempted restart of dead app"
# Log rotation: overfill and re-run; must shrink back to ~1000 lines.
python3 -c "print('\n'.join(['x']*2500))" >>"$BAAS_DIR/logs/watchdog.log"
"$BIN/watchdog.sh" >>"$TDIR/wd.log" 2>&1 || true
lines=$(wc -l <"$BAAS_DIR/logs/watchdog.log")
[ "$lines" -le 1100 ] && ok "watchdog log rotated ($lines lines)" || bad "watchdog log not rotated ($lines lines)"
# Empty registry: watchdog is a clean no-op.
for a in beta gamma delta flaky; do "$BIN/ports.sh" free "$a" >/dev/null; done
assert_exit "watchdog with empty registry exits 0" 0 "$BIN/watchdog.sh"

echo "== shellcheck =="
if command -v shellcheck >/dev/null 2>&1; then
  if shellcheck -S warning "$REPO_BIN"/*.sh "$REPO_BIN/../test/run.sh"; then
    ok "shellcheck clean"
  else
    bad "shellcheck findings"
  fi
else
  echo "SKIP - shellcheck not installed on this machine"
fi

echo
echo "pass=$PASS fail=$FAIL"
[ "$FAIL" -eq 0 ]
