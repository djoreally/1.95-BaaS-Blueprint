## One container per customer: the PocketBase pattern

### The Dockerfile (built on the box)

The customer image is built once, on the VPS, from `deploy/vps/pocketbase/Dockerfile` — PocketBase v0.36.5 plus the sqlite-vec extension (`Dockerfile.vec` / `main_vec.go` for vector-enabled tenants; see [§11](11-vector-rag.md)). One image, every customer. The container is disposable; the volume is the customer.

```bash
# What bin/provision <slug> does (deploy/vps/bin/provision)
docker run -d --name idb-<slug> --restart unless-stopped \
  --network idb-net \
  -v /srv/idb/volumes/<slug>:/pb_data \
  idb-pocketbase:latest serve --http=0.0.0.0:8090 --dir=/pb_data
# then: write /srv/idb/keys/<slug>.key, add sites/<slug>.caddy, caddy reload
```

Inside its own network the container binds `0.0.0.0:8090`; nothing on the public interface ever reaches it. Caddy and the auth gateway are the only public doors ([§06](06-ports-reverse-proxy.md)).

### Why one container per customer — not one PocketBase for everyone

A single shared PocketBase with per-customer collections is cheaper per seat — and wrong for the product. The product promise is "the database file is yours." Isolation must be physical, not logical:

- **Isolation:** one customer's runaway query, corrupt file, or deletion affects exactly one volume
- **Portability:** the customer's data is `/srv/idb/volumes/<slug>/data.db` — a file you can hand them, not rows in a shared schema
- **Blast radius:** a container crash restarts one tenant; compose `restart: unless-stopped` + the poller cover it without waking you
- **Billing honesty:** volume size per slug is measurable, so per-seat cost is auditable

### What one container gives each customer

Included

- Email/password + OAuth auth
- Collections = tables with REST API
- Realtime subscriptions (SSE-based)
- File storage on disk (their volume)
- Admin UI at /_/ (proxied, gateway-authenticated)
- JS hooks for custom logic
- sqlite-vec for vector search (vec image variant)

You add

- Caddy route (`<slug>.invisibledb.app`) — written by `bin/provision`, reloaded into Caddy
- API key via the gateway — `Authorization: Bearer <apiKey>`, stored in `/srv/idb/keys/<slug>.key` (0600)
- Backup schedule — nightly snapshot of their volume into `/srv/idb/backups/`
- Volume — `/srv/idb/volumes/<slug>`, sized and watched per the quota policy ([§03](03-phase-0-resource-diet.md))

### What this replaced

The shared-hosting era had fallbacks for hosts that killed binaries — Passenger Node apps, PHP shims, process watchdogs on a 2-minute cron. None of that applies anymore. Docker is the supervisor now: `restart: unless-stopped`, healthchecks, and image immutability. If a customer's container will not stay up, the answer is `docker logs idb-<slug>` and a fix in the image — not a fallback runtime. The discipline moved up a layer: from "keep the process alive" to "keep the image clean and the volumes measured."
