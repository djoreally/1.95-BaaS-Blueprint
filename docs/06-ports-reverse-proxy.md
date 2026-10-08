## Caddy is your ingress

### The pattern: one Caddyfile entry per customer

Each customer gets a route file at `/srv/idb/caddy/sites/<slug>.caddy`, written by `bin/provision` and removed by `bin/deprovision`, followed by `docker compose exec caddy caddy reload` (zero-downtime — existing connections are untouched):

```
# /srv/idb/caddy/sites/<slug>.caddy
<slug>.invisibledb.app {
    reverse_proxy gateway:8080
}
```

Caddy issues and renews TLS automatically for each listed hostname via Let's Encrypt. The wildcard `*.invisibledb.app` points DNS-only (grey cloud) at the VPS; the apex invisibledb.app points to Vercel where the control plane lives. Caddy never needs to know how many customers there are — it reads the `sites/` directory.

### Port registry — and why Docker made it boring

The old architecture needed a host-port registry (8091–8099 for PocketBase, 8100+ for apps) because every process shared the host network. Docker's `idb-net` bridge makes host-port collision a non-issue:

| What | Where | Port |
| --- | --- | --- |
| Caddy | host :80/:443 (published) | 80, 443 |
| Auth gateway | idb-net only (exposed, not published) | 8080 |
| Customer containers | idb-net only, Docker DNS `idb-<slug>` | 8090 (container-internal, identical for all) |

Every customer container listens on 8090 *inside its own network namespace*. Caddy routes by hostname, the gateway resolves `idb-<slug>` via Docker DNS. The control plane still keeps a slug ↔ container ↔ domain registry (provisioning state in the ProvisionRequest table), but it records hostnames, not ports — ports stopped being a resource to manage.

### Rules that keep you sane

- Never publish a customer container's port to the host; Caddy and the gateway are the only public doors.
- One hostname per customer, always — `<slug>.invisibledb.app` — path-based multi-tenancy (/slug/) breaks PocketBase asset and API URLs the same way it always did.
- The gateway, not Caddy, owns auth: Caddy terminates TLS and routes; the gateway validates the key and swaps the superuser token. Mixing the two is how leaks happen.

## Measured: the full chain works (2026-10-07)

Live verification on vps3695717.trouble-free.net (66.23.224.55), from two independent external networks:

- `https://<slug>.invisibledb.app/api/health` with `Authorization: Bearer <valid-key>` → Caddy (443, auto-TLS) → gateway (key check passes) → customer PocketBase container → **HTTP 200**
- Same request with a bad key → **401** from the gateway — nothing proxied, PocketBase never touched
- TLS: certificate issued automatically on first request, no manual step; wildcard DNS (grey cloud) to the VPS confirmed

This was the highest-risk assumption in the ingress design — that Caddy + a 200-line gateway could replace the entire shared-hosting Apache proxy stack with better isolation. It is now retired: valid key → 200, bad key → 401, TLS automatic.
