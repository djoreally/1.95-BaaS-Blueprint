# supervisor — the on-box reliability kit

Bash + cron supervision for project binaries on shared hosting.
**No systemd, no root, no Docker** — this is the deliberate substitute
(see `docs/07-process-supervision.md`).

## The model

```
cron (every 2 min) → watchdog.sh → registry → per app: pidfile + cmdline check + HTTP health
                                                          ├─ healthy → nothing
                                                          ├─ dead/stale → start.sh
                                                          ├─ alive but unhealthy → restart
                                                          └─ foreign PID → log + hands off
                                              ↘ 3 AM: sqlite WAL checkpoint + VACUUM
```

- One **global** watchdog reads the registry and supervises every app —
  not one cron line per project.
- Each project lives in `~/baas/apps/<project>/`: the binary, `pb_data/`,
  `logs/`, `app.pid`.
- Binaries bind **loopback only** (`127.0.0.1:<port>`); Apache is the sole
  ingress via the `.htaccess` proxy (see `htaccess-proxy.sample`).
- `ports.registry` is the allocation ledger — the control plane allocates
  (`ports.sh alloc`), the watchdog only reads.

## On-box layout

```
~/baas/
  bin/               watchdog.sh, start.sh, stop.sh, ports.sh, htaccess-gen.sh, lib.sh
  apps/<app>/        pocketbase, pb_data/, logs/, app.pid
  registry/ports.registry
  logs/watchdog.log  (rotated, ~1000 lines)
  baas.conf          port range, timeouts
```

## Files

| File | Role |
|---|---|
| `bin/install.sh [--no-cron] [--clean-legacy]` | One-shot setup: layout, script install, seed registry/config, cron merge (idempotent) |
| `bin/watchdog.sh` | Cron entry (every 2 min): liveness per registry row, restarts, log rotation, 3 AM SQLite hygiene |
| `bin/start.sh <app>` | Idempotent launcher (registry-driven; nohup, pidfile, startup log) |
| `bin/stop.sh <app>` | Graceful stop (SIGTERM, 10s WAL-flush grace, then SIGKILL) — pidfile + cmdline verified, never kills foreign PIDs |
| `bin/ports.sh alloc\|free\|list\|get` | Port allocator (flock-guarded, idempotent alloc, freed ports reused) |
| `bin/htaccess-gen.sh <host> <port> [--full]` | Emits the Apache reverse-proxy `.htaccess` for a subdomain |
| `bin/lib.sh` | Shared helpers (sourced, not executed) |
| `ports.registry` | Format template for the live registry |
| `htaccess-proxy.sample` | Generated example (via `htaccess-gen.sh`) |
| `templates/baas.conf` | Config template |
| `test/run.sh` | Harness: 26 checks, all in /tmp, no live services |

## Install order (per hosting account, once)

1. Copy `bin/` to the box (FTP, or the adapter's deploy step).
2. Run `bin/install.sh` — creates `~/baas`, installs scripts, seeds the
   registry, merges the cron line (re-runnable; never duplicates).
3. Per project: `ports.sh alloc <app>` → deploy binary to
   `~/baas/apps/<app>/pocketbase` (`chmod +x`) → `htaccess-gen.sh` into the
   subdomain docroot → `bin/start.sh <app>`. The watchdog takes it from there.

## Port ranges

Default `18000–18999` (configurable in `baas.conf`). This supersedes the
`8091–8099` sketch in `docs/06-ports-reverse-proxy.md`: loopback-only
binding means any range works, and 1000 ports give real headroom for
multi-project accounts.

## Resource budgets (measured)

PocketBase v0.36.5 idles at **~27 MB RSS** on the OrangeHost Micro box
(measured 2026-10-05). Plan ~40 MB headroom per project: a 1 GB LVE
account comfortably holds 10–15 live projects; the reseller tier (one
cPanel account per tenant) is the escape hatch past that.

## Adapter integration note

`packages/adapter-cpanel/src/provision.ts` currently installs a **per-project**
cron line (`$HOME/apps/<name>/watchdog.sh`, every 5 min). That convention is
superseded by this package: the createProject cron step should install the
single global line once (idempotent) —

```
*/2 * * * * $HOME/baas/bin/watchdog.sh >> $HOME/baas/logs/watchdog.log 2>&1
```

— and the rollback matcher should target `baas/bin/watchdog.sh` instead of
`apps/<name>/watchdog.sh`. `install.sh --clean-legacy` removes old
per-project lines.

## The safety guarantee

`stop.sh` and the watchdog only ever signal the PID recorded in the app's
own pidfile, and only after `/proc/<pid>/cmdline` confirms it is our binary.
A recycled or foreign PID is logged and left alone — verified by the harness
(`watchdog: never kills foreign processes`).

## What this gives up vs systemd — honestly

- ~2-minute detection latency (not seconds).
- No journald: logs are files; rotation keeps the last ~1000 lines.
- No cgroup limits per project: one runaway project can pressure the shared
  1 GB — the reseller tier (one cPanel account per tenant) is the real fix.

## Testing

`test/run.sh` — 26 checks, all inside a throwaway `$BAAS_DIR` in /tmp:
allocator (sequential, idempotent, reuse, validation), registry get/list,
htaccess generation (selective + full), stale-pidfile handling, the
foreign-PID refusal, the dead-app restart path, log rotation, empty-registry
no-op. `shellcheck` is run when available (not installed on this machine —
noted, scripts written to its conventions: `set -euo pipefail`, quoted
expansions, `SC2086`/`SC1091` disables where intentional).
