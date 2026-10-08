## Architecture at a glance: the VPS is the substrate

Five layers. Only the control plane and the provisioning glue are software you write; the rest is standard infrastructure wired together once.

1 Control Plane

Your product.

Next.js on Vercel at www.invisibledb.app: signup, billing (Stripe), API keys, project dashboard, usage. Stores provisioning state in a ProvisionRequest table (Prisma/Postgres) that the VPS poller reads. Docs and marketing ship here too.

You build this

2 Provisioning

Stripe webhook → ProvisionRequest → VPS poller (cron, every 2 min, authenticates with VPS_API_SECRET) → `bin/provision <slug>`, which creates the customer container, writes `/srv/idb/keys/<slug>.key`, and adds the Caddy route. No human touches the box for a new customer. (Deprovision is the mirror image: `bin/deprovision <slug>`.)

You build this; Docker + cron provide it

3 Runtime

One

PocketBase Docker container per customer

— built from the Dockerfile in `deploy/vps/pocketbase` (image built on the box), each with its own isolated SQLite volume under `/srv/idb`. Containers join the `idb-net` bridge network at provision time; they are never exposed publicly. The customer's data is a real file on disk — they can own it outright.

Docker provides; you script it

4 Edge

Caddy + auth gateway in front.

Caddy terminates TLS automatically (Let's Encrypt, wildcard `*.invisibledb.app` — DNS-only to the VPS, grey cloud; apex invisibledb.app points to Vercel) and routes `<slug>.invisibledb.app` → gateway → the customer's container. The gateway validates `Authorization: Bearer <apiKey>` against `/srv/idb/keys/<slug>.key`, timing-safe compares, swaps in a cached PocketBase superuser token, and proxies. Valid key → 200. Bad key → 401, no proxying. PocketBase never sees the internet.

Caddy provides; the gateway is ~200 lines of dependency-free Node

5 Data / Backup

SQLite files per customer under `/srv/idb`, snapshotted by host cron into `/srv/idb/backups/` nightly (`bin/backup`). sqlite-vec lives beside the data for vector search — see [§11](11-vector-rag.md). Offsite copies belong to the phase-3 control plane, not the MVP box.

### Request flow

```
Browser → Caddy (:443, auto-TLS, <slug>.invisibledb.app)
  → auth gateway (:8080, idb-net) — Bearer API key check:
      valid   → 200 path continues
      invalid → 401, nothing proxied
  → idb-<slug> container (PocketBase, superuser token swapped in)
  → SQLite volume (WAL) + pb_data/storage (uploaded files)
  → nightly cron → /srv/idb/backups/ (SQLite snapshots)
```

### Why PocketBase first

One static Go binary (~25 MB) delivers authentication (email/password, OAuth), collections as REST + realtime API, file storage, an admin dashboard, and cron hooks — roughly 80% of Supabase's surface with none of its moving parts. It idles at ~27 MB RSS measured (2026-10-05), which is why a $3/mo box can hold a fleet of customer containers — the per-customer cost is one container and one volume, not another server. SQLite is not a compromise here; it is the thesis: the customer's database is a file they own, no Postgres instance to babysit, no bill to fear.
 — Phase 0
