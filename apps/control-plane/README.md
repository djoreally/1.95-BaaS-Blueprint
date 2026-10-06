# control-plane — Layer 4: the customer-facing product

Next.js (App Router) dashboard for the 1.95 BaaS. The moat is the experience:
landing → signup → connect hosting → new project → live provisioning feed →
project dashboard. Every button that claims to do something calls the real
`@baas-195/adapter-cpanel` — no mock data in the provisioning path.

## Routes

| Route | What it does |
|---|---|
| `/` | Landing — "Everything PocketHost does, on hosting you already pay $2 for" |
| `/signup` | **STUBBED** — name/email → cookie session, no real auth (prod: real accounts) |
| `/connect` | Hosting connect form (host + user + **API token, never password**) → `POST /api/connect` runs the server-side preflight: :2083 reachable, token valid (read-only `DomainInfo/list_domains` via the real adapter), wildcard DNS via Cloudflare DoH, substrate facts. Green checklist → connection stored in-memory (**prod: encrypted vault**) |
| `/projects` | Project list (live status badges) |
| `/projects/new` | Wizard: name + domain → `POST /api/projects` → real `createProject()` |
| `/projects/[id]` | Provisioning feed while working (polls every 2s, each adapter step appears live); dashboard when ready — overview (live `/api/health` badge), API keys, Auth, Database (provisioned MySQL + generated password), Storage, Vector (sqlite-vec), Backups (Litestream plan), Logs (scrubbed call log), Settings (real `deleteProject()` with confirm) |

## API routes

- `POST /api/connect` — preflight + store connection
- `GET /api/projects` — list jobs · `POST /api/projects` — start provisioning (202 + job id; runs in background)
- `GET /api/projects/[id]` — job status/steps (DB password never exposed here)
- `DELETE /api/projects/[id]` — real `deleteProject()` teardown, then drop from store

## How the live feed works

`createProject()` doesn't emit progress events, so the control plane wraps the
adapter's injectable `fetchImpl`: every raw UAPI call flips its feed step to
running → done as it completes (transport retries keep it in "retrying").
Step order mirrors the provisioner: subdomain → database → db user →
privileges → SSL → cron → proxy rules (`.htaccess` written post-provision via
`UapiClient.writeFile`, since it's not part of `createProject`).

`cronSkipped: true` is a **normal expected state** (UAPI Cron is broken on
some hosts) — the dashboard shows the one-line global watchdog cron to add
manually. `sslPending` shows a "usually lands in minutes" note.

## Demo seed

On boot the store seeds the real demo project (`vibecode.momsoilchange.com` →
`127.0.0.1:18001`, db `momsoilc_demo_db`) so the dashboard shows live data
immediately — the health badge curls the real endpoint.

## Run

```bash
npm run build   # must pass
npm run dev     # http://localhost:3000
```

No env vars needed — the hosting connection comes from `/connect` at runtime.
