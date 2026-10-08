# InvisibleDB — Living Documentation

The full technical spec for **InvisibleDB**: the invisible backend for web and
mobile apps. One control plane, one $3/mo VPS, Dockerized per-customer
PocketBase instances — auth, database, files, realtime, and vector search for
$6.99/mo per seat, with the database file belonging to the customer.

These pages are the living source of truth — edit them as the build teaches us
things. [`BaaS-Blueprint.pdf`](BaaS-Blueprint.pdf) is the printable snapshot of
the original blueprint; it predates the VPS pivot and is kept for history.

> Status: live and provisioning. VPS runtime deployed 2026-10-07, first
> customer provision verified end-to-end, Stripe billing wired 2026-10-08.
> The 1.0 launch gate is the stranger golden-path test (§17).

## Contents

1. [Thesis](01-thesis.md) — The invisible backend: one email address in, an isolated database out. Why the $3/mo VPS beats the reseller ladder.
2. [System Architecture](02-architecture.md) — Five layers: control plane, provisioning queue, per-customer containers, Caddy edge + auth gateway, SQLite volumes.
3. [Phase 0: VPS Resource Hygiene](03-phase-0-resource-diet.md) — Keeping the $3/mo box healthy: Docker disk, volume quotas, log rotation, WAL discipline.
4. [Environment Constraints](04-environment-constraints.md) — What the VPS gives you (root, Docker) and what still needs discipline: small box, single failure domain, no managed Postgres.
5. [Single-Binary Apps, Containerized](05-single-binary-apps.md) — The PocketBase pattern in Docker: one container per customer, what it gives, what you add.
6. [Ports & Reverse Proxy](06-ports-reverse-proxy.md) — Caddy as ingress: per-customer routes, auto-TLS, Docker networking. The gateway key check.
7. [Process Supervision](07-process-supervision.md) — Docker restart policies + healthchecks, the 2-minute provision poller, the 02:00 backup cron.
8. [Multi-Tenant Pattern](08-multi-tenant-pattern.md) — One container + one volume per customer: the isolation decision, capacity planning, the scale path.
9. [SSL & Domains](09-ssl-domains.md) — Caddy auto-TLS, wildcard `*.invisibledb.app`, per-customer subdomains, custom domains as the paid feature.
10. [Auth, Files & Data](10-auth-files-data.md) — PocketBase auth + collections as BaaS tables; per-customer volumes; the two tenancy layers.
11. [Vector Search & AI Memory](11-vector-rag.md) — RAG without Postgres: sqlite-vec default, the client connection pattern, hybrid HNSW scale exit.
12. [Backups & Maintenance](12-backups-maintenance.md) — Per-customer SQLite volume backups via cron, the restore drill nobody skips.
13. [Deployment Pipeline](13-deployment-pipeline.md) — Two tracks: control plane via Vercel, VPS runtime via compose. Safe swaps and rollback.
14. [Control Plane](14-control-plane.md) — The product itself: "Your Databases" dashboard, Stripe billing, provisioning queue. Moat = experience + agent interface.
15. [Unit Economics & Scaling](15-reseller-tier.md) — The math: $3/mo box, ~$0.76/seat at scale, $6.99 price → the margin. Single VPS → bigger VPS → multi-VPS.
16. [Resource Budgets & Limits](16-resource-budgets-limits.md) — What breaks first on the box, the move for each, and customer data portability.
17. [Build Log & Launch Gate](17-build-roadmap.md) — What was actually built (2026-10-07→08) and what "1.0 launched" means: the stranger golden-path test.
18. [Reference](18-reference.md) — Copy-paste starter kit: `/srv/idb` layout, Caddyfile pattern, provision script, VPS preflight checklist.
