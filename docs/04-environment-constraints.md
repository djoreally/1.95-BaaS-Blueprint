## What the VPS gives you — and the discipline it still needs

The old story was "design around the cage": no root, no Docker, LVE limits, hosts killing processes. That story is over. You have root, Docker, systemd, and cron on a $3/mo Ubuntu 24.04 box. The constraints that remain are fewer — but they are real, and the honest ones are economic and architectural, not permission-based.

| Constraint | Reality on the InterServer VPS | Design answer |
| --- | --- | --- |
| A $3/mo box is small | Slice RAM and disk are modest; one box is not a fleet | Per-customer memory budget ([§16](16-resource-budgets-limits.md)); Phase 0 diet stays on forever ([§03](03-phase-0-resource-diet.md)) |
| Single point of failure | One VPS = one blast radius | Nightly SQLite snapshots ([§12](12-backups-maintenance.md)); second-box migration plan in [§16](16-resource-budgets-limits.md) |
| No managed Postgres | There is no RDS here | SQLite is primary by design, not by compromise — the customer owns the file ([§10](10-auth-files-data.md)) |
| Outbound email | No mail server worth running on a slice | Transactional email via API (Resend-style); never SMTP off the box |
| Shared IP / residential reputation | Port 25 blocked, IP may be on blocklists | Same answer: API-based email; backups go over HTTPS |
| One operator | You are the whole SRE team | Everything provisioned by scripts (`bin/provision`, `bin/backup`), supervised by compose `restart: unless-stopped` + a 2-minute watchdog poller |

### The mindset shift

On shared hosting the question was "what is already running that I can orchestrate?" On your own VPS the question is "what do I stop needing to orchestrate?" TLS issuance (Caddy), container lifecycle (compose), scheduling (cron) — all solved problems now. What remains is the discipline: sizing per customer, pruning Docker, keeping the backups honest, and never letting one customer's growth take the box down for everyone else.

## Measured on the InterServer VPS (2026-10-07)

Docker + Caddy + auth gateway + one PocketBase v0.36.5 customer container verified live end-to-end:

- `GET /api/health` through the full chain — Caddy (443, auto-TLS on `<slug>.invisibledb.app`) → gateway (Bearer key check) → customer container → **HTTP 200**
- Bad API key → **401**, no proxying — PocketBase never sees the internet or the key
- Gateway key swap: customer's `Bearer` key is timing-safe-compared against `/srv/idb/keys/<slug>.key`, then a cached PocketBase superuser token is proxied — one re-auth retry on PB 401
- Idle RSS per customer container: ~27 MB — consistent with the earlier shared-host measurement (2026-10-05), which is why the per-customer memory budget in [§16](16-resource-budgets-limits.md) works on a slice

This was the highest-risk assumption in the new architecture — that a $3 box could hold the edge, the gateway, and a growing fleet of customer containers with honest isolation. The measurement says yes. The budget in [§16](16-resource-budgets-limits.md) says how many.
