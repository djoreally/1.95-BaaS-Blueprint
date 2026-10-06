#!/usr/bin/env bash
# ports.sh — port allocator + registry manager.
# The registry is the single source of truth for app <-> port allocation.
# The control plane allocates; the watchdog only reads.
#
#   ports.sh alloc <app> [binary] [health_path]  -> prints the port (idempotent)
#   ports.sh free  <app>                          -> releases the app's row
#   ports.sh list                                -> human-readable table
#   ports.sh get   <app> <field>                  -> field: port|binary|health_path|data_dir|pidfile
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"
load_config

usage() {
  cat >&2 <<'EOF'
usage:
  ports.sh alloc <app> [binary] [health_path]   allocate (or return) the app's port
  ports.sh free  <app>                          release the app's port
  ports.sh list                                list allocations
  ports.sh get   <app> <field>                  print one field
fields: port | binary | health_path | data_dir | pidfile
app names: lowercase letters, digits, dashes.
EOF
  exit 1
}

# --- locked helpers (run under with_registry_lock) ---------------------------

_alloc_locked() { # _alloc_locked <app> <binary> <health>
  local app="$1" binary="$2" health="$3"
  local existing port used
  existing="$(get_app_field "$app" 2 || true)"
  if [ -n "$existing" ]; then
    echo "$existing" # idempotent: already allocated
    return 0
  fi
  used="$(registry_rows | awk -F'\t' '{ print $2 }' | sort -n | tr '\n' ' ')"
  port="$PORT_RANGE_START"
  while [ "$port" -le "$PORT_RANGE_END" ]; do
    case " $used " in
    *" $port "*) ;;
    *) break ;;
    esac
    port=$((port + 1))
  done
  if [ "$port" -gt "$PORT_RANGE_END" ]; then
    echo "error: port range $PORT_RANGE_START-$PORT_RANGE_END exhausted" >&2
    return 1
  fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$app" "$port" "$binary" "$health" \
    "apps/$app/pb_data" "apps/$app/app.pid" "" >>"$(registry_file)"
  echo "$port"
}

_free_locked() { # _free_locked <app>
  local app="$1" reg tmp
  reg="$(registry_file)"
  [ -f "$reg" ] || return 0
  tmp="$reg.tmp.$$"
  awk -F'\t' -v app="$app" '$1 != app' "$reg" >"$tmp" && mv "$tmp" "$reg"
}

# --- commands ----------------------------------------------------------------

cmd_alloc() {
  local app="${1:-}" binary="${2:-}" health="${3:-/api/health}"
  valid_app_name "$app" || {
    echo "error: invalid app name '$app' (lowercase, digits, dashes)" >&2
    exit 1
  }
  binary="${binary:-apps/$app/pocketbase}"
  case "$binary" in
  /* | *".."* | *" "*) echo "error: binary path must be relative, no spaces or '..'" >&2 && exit 1 ;;
  esac
  mkdir -p "$(dirname "$(registry_file)")"
  [ -f "$(registry_file)" ] || {
    echo "error: registry not found — run install.sh first" >&2
    exit 1
  }
  with_registry_lock _alloc_locked "$app" "$binary" "$health"
}

cmd_free() {
  local app="${1:-}"
  valid_app_name "$app" || {
    echo "error: invalid app name '$app'" >&2
    exit 1
  }
  with_registry_lock _free_locked "$app"
  echo "freed $app"
}

cmd_list() {
  printf '%-24s %-7s %s\n' "APP" "PORT" "BINARY"
  registry_rows | awk -F'\t' '{ printf "%-24s %-7s %s\n", $1, $2, $3 }'
}

cmd_get() {
  local app="${1:-}" field="${2:-}" col val
  valid_app_name "$app" || {
    echo "error: invalid app name '$app'" >&2
    exit 1
  }
  case "$field" in
  port) col=2 ;;
  binary) col=3 ;;
  health_path) col=4 ;;
  data_dir) col=5 ;;
  pidfile) col=6 ;;
  *)
    echo "error: unknown field '$field'" >&2
    exit 1
    ;;
  esac
  val="$(get_app_field "$app" "$col" || true)"
  if [ -z "$val" ]; then
    echo "error: app '$app' not in registry" >&2
    exit 1
  fi
  echo "$val"
}

# --- dispatch ----------------------------------------------------------------
cmd="${1:-}"
case "$cmd" in
alloc) shift; cmd_alloc "$@" ;;
free) shift; cmd_free "$@" ;;
list) cmd_list ;;
get) shift; cmd_get "$@" ;;
*) usage ;;
esac
