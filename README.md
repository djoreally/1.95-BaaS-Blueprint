# InvisibleDB

**Invisible backend for web and mobile apps.** You give us an email address, we provision an isolated, secure SQLite database in the cloud for you instantly. Auth, files, and vector embeddings native. One snippet, API key in an env var, back to building your actual app features.

**Live:** [invisibledb.app](https://www.invisibledb.app) · **Pricing:** $6.99/mo per seat, first month $1

## How it works

```
Customer → Control plane → Stripe → ProvisionRequest → VPS poller (2 min)
  → isolated PocketBase + SQLite container → *.invisibledb.app endpoint
  → SDK / REST / MCP / CLI access
```

- **Control plane** (this repo): Next.js on Vercel — marketing, docs, signup, Stripe billing, `/projects` ("Your Databases") dashboard, super-admin.
- **Runtime**: InterServer VPS ($3/mo) running Docker — Caddy (auto-TLS) → auth gateway (API key check) → per-customer PocketBase containers with isolated SQLite volumes.
- **Provisioning**: Stripe webhook creates a `ProvisionRequest` row; the VPS poller picks it up every 2 minutes and runs `bin/provision`.
- **Access**: JS SDK, Dart SDK (Flutter), `idb` CLI, and a real MCP server — AI agents can provision, query, and manage backends directly.

## Repository layout

```
apps/control-plane/    Next.js — marketing, docs, auth, billing, /projects dashboard, admin
packages/sdk-js/       JavaScript/TypeScript SDK (CRUD, files, vectors, realtime)
packages/sdk-dart/     Dart/Flutter SDK
packages/cli/          `idb` command-line tool
packages/mcp-server/   MCP server — AI agents provision and query backends
deploy/vps/            VPS runtime: compose, Caddy, auth gateway, provision scripts, runbook
docs/                  Living documentation (18 pages) + printable PDF snapshot
```

See [PLATFORM_MAP.md](PLATFORM_MAP.md) for the full architecture, component inventory, and money flow.

## Status

🟢 **Live and provisioning.** Control plane on Vercel, VPS runtime deployed and serving customer instances, Stripe billing wired ($6.99/mo, first month $1). See PLATFORM_MAP.md for the honest per-component state.

## Licenses

- `packages/*` (SDKs, CLI, adapter, supervisor): Apache-2.0
- `apps/control-plane`: AGPL-3.0-only
