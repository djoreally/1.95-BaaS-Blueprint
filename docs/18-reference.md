## Reference kit: the VPS substrate

### Canonical layout on the box (`/srv/idb`)

```
compose.yml            # caddy + gateway services (customer containers join idb-net at provision time)
.env                   # BASE_DOMAIN, ACME_EMAIL, CONTROL_PLANE_URL, VPS_API_SECRET (root-readable only)
caddy/Caddyfile        # edge: *.invisibledb.app wildcard + per-customer routes written by bin/provision
caddy/sites/           # per-customer route files: <slug>.caddy
gateway/               # auth gateway: Bearer <apiKey> -> PocketBase token swap, Host-header routing
bin/provision          # provision <slug> <email>: volume + container + superuser + API key + Caddy route
bin/deprovision        # final backup, then remove container + volume + route
bin/backup             # nightly: online sqlite3 .backup per volume, retention, off-box rsync
bin/poll-provision     # host cron every 2 min: claim ProvisionRequest rows, run provision/deprovision, report back
keys/<slug>.key        # per-customer API keys, 0600 — shown to the customer once, never logged
backups/               # nightly SQLite dumps (convenience copies; off-box rsync is the archive)
```

### Preflight — run before trusting any new VPS

- Docker installed and the daemon survives a reboot; `docker compose` available
- `/srv/idb` populated from the repo; all of `bin/` executable
- `.env` complete: `BASE_DOMAIN`, `ACME_EMAIL`, `CONTROL_PLANE_URL`, `VPS_API_SECRET` (generated with `openssl rand -hex 32`, also set in Vercel env)
- `docker compose up -d --build` → caddy + gateway Up; pocketbase image builds clean
- Wildcard DNS `*.BASE_DOMAIN` → box IP, DNS-only (no proxying that hides the origin)
- Caddy issues a cert for a test subdomain on first request; time-to-cert measured
- `bin/provision test <email>` succeeds end to end: container up, route live, `/api/health` 200 with the key, 401 without it; then `bin/deprovision test`
- Poller cron installed (`*/2 * * * *` → `bin/poll-provision`); a test `ProvisionRequest` row is claimed and reported within one cycle
- `bin/backup` runs; a restore from the dump onto a fresh volume is verified, not assumed
- Stripe webhook endpoint `/api/billing/webhook` reachable from the control plane with signature verification (the box never sees Stripe)
- UFW (or equivalent): 22/80/443 only; unattended-upgrades + fail2ban on

### The money flow (canonical)

Stripe Checkout → `checkout.session.completed` → `Subscription` row + `ProvisionRequest` row (Neon) → VPS poller claims it (2 min) → `bin/provision` → customer gets endpoint + API key. Cancel → `customer.subscription.deleted` → deprovision queue → `bin/deprovision`.

### Assumptions this blueprint makes (verify, do not trust)

PocketBase idle memory (30–60 MB per container), the $3 slice's practical ceiling (~10–15 light customers before RAM binds), the 2-minute poller interval, and nightly backup cadence are planning estimates — the first month of real tenants replaces them with observed numbers. Stripe objects as of 2026-10-08: product `prod_VOxrNECaDbKlsF`, price `price_1UO9wRADolYVlmkJHgCt9lcR` ($6.99/mo), coupon `FIRST_MONTH_1` ($5.99 off, once). Re-confirm before any public claim.

BaaS Blueprint — Tyreese Burton, October 2026. Reference: InterServer VPS vps3695717 (66.23.224.55), Ubuntu 24.04, Docker.
