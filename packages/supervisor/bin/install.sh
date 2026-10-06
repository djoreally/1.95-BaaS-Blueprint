#!/usr/bin/env bash
# install.sh [--no-cron] [--clean-legacy] — one-shot on-box setup for the baas kit.
#
#   1. creates $HOME/baas/{apps,registry,logs,bin}
#   2. installs the scripts to $HOME/baas/bin (+ seeds registry + baas.conf)
#   3. merges the watchdog cron line (idempotent — never duplicates)
#
# Run from this package's bin/ directory after copying it to the box
# (FTP, or the adapter's deploy step). Safe to re-run.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BAAS="${BAAS_DIR:-$HOME/baas}"

NO_CRON=0
CLEAN_LEGACY=0
for arg in "$@"; do
  case "$arg" in
  --no-cron) NO_CRON=1 ;;
  --clean-legacy) CLEAN_LEGACY=1 ;;
  *)
    echo "error: unknown flag '$arg'" >&2
    exit 1
    ;;
  esac
done

mkdir -p "$BAAS/apps" "$BAAS/registry" "$BAAS/logs" "$BAAS/bin"
for s in lib.sh watchdog.sh start.sh stop.sh ports.sh htaccess-gen.sh; do
  install -m 0755 "$SCRIPT_DIR/$s" "$BAAS/bin/$s"
done
echo "installed scripts -> $BAAS/bin/"

if [ ! -f "$BAAS/registry/ports.registry" ]; then
  cp "$SCRIPT_DIR/../ports.registry" "$BAAS/registry/ports.registry"
  echo "seeded registry   -> $BAAS/registry/ports.registry"
fi
if [ ! -f "$BAAS/baas.conf" ]; then
  cp "$SCRIPT_DIR/../templates/baas.conf" "$BAAS/baas.conf"
  echo "seeded config     -> $BAAS/baas.conf"
fi

if [ "$NO_CRON" -eq 0 ]; then
  CRON_LINE="*/2 * * * * $BAAS/bin/watchdog.sh >> $BAAS/logs/watchdog.log 2>&1"
  current="$(crontab -l 2>/dev/null || true)"
  if printf '%s\n' "$current" | grep -qF "baas/bin/watchdog.sh"; then
    echo "cron: watchdog line already present — skipping"
  else
    {
      [ -n "$current" ] && printf '%s\n' "$current"
      printf '%s\n' "$CRON_LINE"
    } | crontab -
    echo "cron: installed (watchdog every 2 minutes)"
  fi

  # The old per-project layout (~/apps/<name>/watchdog.sh) is superseded by
  # the global watchdog. Detect leftovers; remove only when asked.
  legacy="$(printf '%s\n' "$current" | grep -E 'apps/[^ ]*/watchdog\.sh' || true)"
  if [ -n "$legacy" ]; then
    if [ "$CLEAN_LEGACY" -eq 1 ]; then
      printf '%s\n' "$current" | grep -vE 'apps/[^ ]*/watchdog\.sh' | crontab -
      echo "cron: removed legacy per-project watchdog lines"
    else
      echo "note: legacy per-project watchdog lines detected (old ~/apps layout):"
      printf '%s\n' "$legacy"
      echo "      re-run with --clean-legacy to remove them"
    fi
  fi
else
  echo "cron: skipped (--no-cron)"
fi

cat <<EOF

Next steps per project:
  1. Allocate a port:   $BAAS/bin/ports.sh alloc <app>
  2. Deploy the binary: <app> -> $BAAS/apps/<app>/pocketbase  (chmod +x)
  3. Generate .htaccess: $BAAS/bin/htaccess-gen.sh <app.example.com> <port> > ~/public_html/<app>/.htaccess
  4. Start it:          $BAAS/bin/start.sh <app>
  5. The watchdog (cron, every 2 min) takes it from there.
EOF
