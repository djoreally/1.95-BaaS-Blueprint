# BaaS Blueprint — Living Documentation

The full technical spec for the **1.95 BaaS**: a Coolify-style application platform
built for cheap cPanel shared hosting. These pages are the living source of truth —
edit them as the build teaches us things. [`BaaS-Blueprint.pdf`](BaaS-Blueprint.pdf)
is the printable snapshot of the same content.

> Status: blueprint complete, Week 1 measurements pending. Memory figures and the
> 5–8 project ceiling are planning estimates until measured on the Micro box.

## Contents

1. [Thesis](01-thesis.md) — Coolify-style experience on $2 shared hosting by treating cPanel as the substrate, not Docker.
2. [System Architecture](02-architecture.md) — Five layers: control plane, UAPI provisioning, single-binary runtime, Apache proxy, SQLite/MySQL/files data layer.
3. [Phase 0: Storage & Resource Diet](03-phase-0-resource-diet.md) — Freeing the box from 50% to <30% disk; log caps and WAL discipline that make 5 GB viable.
4. [Environment Constraints](04-environment-constraints.md) — Designing inside the cage: no root, no systemd, no Docker — CloudLinux LVE, Passenger, cron supervision.
5. [Single-Binary Apps](05-single-binary-apps.md) — The PocketBase pattern: one process per project gives auth, DB, files, realtime, admin.
6. [Ports & Reverse Proxy](06-ports-reverse-proxy.md) — High-port allocation plus Apache `mod_proxy`/`mod_rewrite` via `.htaccess`; WebSocket/SSE notes.
7. [Process Supervision](07-process-supervision.md) — Cron watchdog + start/stop scripts + Passenger restarts: 99% of systemd for side projects.
8. [Multi-Tenant Pattern](08-multi-tenant-pattern.md) — One PocketBase per project vs. one shared instance; memory budget and the isolation tradeoff under 1 GB RAM.
9. [SSL & Domains](09-ssl-domains.md) — AutoSSL + UAPI subdomain creation; `project.example.com` by default, custom domains as the paid feature.
10. [Auth, Files & Data](10-auth-files-data.md) — PocketBase auth + collections as BaaS tables; when to reach for MySQL; file storage quotas.
11. [Vector Search & AI Memory](11-vector-rag.md) — RAG without Postgres: sqlite-vec default, MySQL 9.0/8.0 paths, hybrid HNSW scale exit, and the client connection pattern.
12. [Backups & Maintenance](12-backups-maintenance.md) — Continuous SQLite replication with Litestream to free R2/B2, plus the restore drill nobody skips.
13. [Deployment Pipeline](13-deployment-pipeline.md) — Push-to-deploy without a CI runner on the box: webhook → binary swap → health check → rollback.
14. [Control Plane](14-control-plane.md) — The Coolify-style product itself: MVP feature map, and why the moat is UX (sanctioned cPanel API path, v138 pinned).
15. [Reseller Tier](15-reseller-tier.md) — The real multi-tenant substrate: $19/mo Spark = $0.76 per isolated cPanel account via WHM API; Micro → Spark graduation path.
16. [Resource Budgets & Limits](16-resource-budgets-limits.md) — Hard ceilings, what breaks first, and the VPS escape hatch.
17. [Build Roadmap](17-build-roadmap.md) — Four weeks from blueprint to first tenant, sequenced and evidence-gated.
18. [Reference](18-reference.md) — Copy-paste starter kit: canonical layout, `.htaccess`, watchdog, `litestream.yml`, deploy script, and the host preflight checklist.
