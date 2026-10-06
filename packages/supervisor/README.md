# supervisor — the on-box reliability kit

Bash + cron supervision for project binaries on shared hosting.
**No systemd, no root, no Docker** — this is the deliberate substitute
(see `docs/07-process-supervision.md`).

## The model

```
cron (every 5 min) → watchdog.sh → pidfile + TCP check → start.sh (if down)
                                              ↘ nightly: sqlite WAL checkpoint + VACUUM
```

- Each project lives in `~/apps/<project>/`: the binary, `pb_data/`, `logs/`,
  `app.pid`, and a `port` file.
- Binaries bind **loopback only** (`127.0.0.1:<port>`); Apache is the sole
  ingress via the `.htaccess` proxy (see `htaccess-proxy.sample`).
- `ports.registry` is the allocation ledger — the control plane assigns,
  the watchdog reads.

## Files

| File | Role |
|---|---|
| `start.sh <project> <port> [binary]` | Boot (idempotent; skips if pidfile alive) |
| `stop.sh <project>` | Graceful stop (SIGTERM, 10s grace for WAL flush, then SIGKILL) |
| `watchdog.sh` | Cron entry: liveness check + restart + nightly SQLite hygiene |
| `ports.registry` | Project ↔ port ledger (control plane owns, watchdog reads) |
| `htaccess-proxy.sample` | Apache reverse-proxy recipe for the subdomain docroot |

## Install order (per project)

1. `createProject()` (adapter) provisions subdomain + DB + cron line.
2. Copy this kit to `~/apps/<project>/`, write the allocated port to `port`.
3. Write `htaccess-proxy.sample` (port substituted) to the subdomain docroot.
4. `start.sh` — the next watchdog run (≤5 min) self-heals any first-boot crash.

## What this gives up vs systemd — honestly

- 5-minute detection latency (not seconds).
- No journald: logs are files; rotation is a cron `find -delete` (see docs).
- No cgroup limits: one runaway project can pressure the shared 1 GB —
  the reseller tier (one cPanel account per tenant) is the real fix.
