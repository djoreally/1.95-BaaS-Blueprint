# 1.95-BaaS-Blueprint
A Coolify-style platform for the tier Coolify cannot reach: cheap cPanel shared hosting. One control plane, single-binary backends, and a repeatable recipe that turns a $2/month hosting account into auth, database, files, realtime, and deploys for a portfolio of side projects.

## The blueprint

The full technical spec lives in [`docs/`](docs/) as living documentation — 18 pages
covering the Phase 0 resource diet, the non-root architecture (single-binary backends,
Apache reverse-proxying, cron watchdog supervision instead of systemd), the multi-project
pattern under 1 GB RAM, per-project SSL and domain wiring, vector search & RAG,
Litestream-to-R2/B2 backups, the push-to-deploy pipeline, the control-plane MVP mapped
to cPanel UAPI / WHM API calls, and the reseller tier economics ($0.76/seat at $19/mo
for 25 cPanel accounts). A printable snapshot is kept at
[`docs/BaaS-Blueprint.pdf`](docs/BaaS-Blueprint.pdf) — edit the markdown, not the PDF.

## How it works

- **Control plane** (this repo's product): a dashboard that provisions projects through the cPanel UAPI / WHM API — connect a repo, pick a subdomain, and it wires up the app, database, env vars, SSL, and deployment. No Docker. No root. No VPS.
- **Runtime**: single-binary backends (PocketBase-style) running under the hosting account's process model.
- **Data**: SQLite per project, streamed offsite with Litestream.
- **Substrate ladder**: prove the pattern on a $1.95 Micro box → graduate tenants to isolated cPanel accounts on a reseller plan.

## Roadmap

- **Week 1** — Measure, don't guess: real memory/disk numbers on the Micro box; prove a PocketBase binary survives CloudLinux process limits.
- **Week 2** — Provisioning primitives: UAPI wrappers for subdomain + MySQL + Node app + SSL as one `create-project` call.
- **Week 3** — Supervisor + proxy: cron watchdog, port registry, `.htaccess` proxy recipe, per-project health checks.
- **Week 4** — Control-plane MVP: dashboard, push-to-deploy, Litestream backups, first real tenant.

## Status

🚧 Early build. The blueprint is done; the code starts now.

## Repository layout

npm workspaces monorepo (`private: true`):

```
packages/adapter-cpanel/   Typed cPanel UAPI + WHM API client; createProject() orchestration
packages/supervisor/       On-box bash kit: start/stop/watchdog, port registry, .htaccess proxy
apps/control-plane/        Next.js dashboard (the moat) — MVP skeleton
docs/                      Living documentation (18 pages) + printable PDF snapshot
```

`npm install` has not been run — dependencies are declared, not installed.
