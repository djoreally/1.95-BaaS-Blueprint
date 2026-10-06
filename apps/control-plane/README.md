# control-plane — the Coolify-style dashboard

Next.js app. **This is the moat**: the UAPI/WHM wrapping is a commodity recipe —
the defensible asset is the experience (see `docs/14-control-plane.md`).

## MVP feature map

| Feature | Status | Notes |
|---|---|---|
| Connect hosting account | TODO | cPanel host + user + API token → verify with a harmless UAPI call |
| Create project wizard | TODO | name → subdomain + MySQL + port allocation + SSL, one click |
| Project list / status | skeleton | `app/page.tsx` lists projects; wire to real store |
| Env vars per project | TODO | stored server-side, injected at deploy |
| Logs viewer | TODO | tails `~/apps/<project>/logs/` via the adapter |
| Domains (subdomain + custom) | TODO | AutoSSL status per domain |
| Vector toggle | TODO | per-project sqlite-vec enablement (see `docs/11-vector-rag.md`) |
| Backups view + restore | TODO | Litestream status, one-click restore drill |

## Wiring

- All hosting calls go through `@baas-195/adapter-cpanel` (`lib/adapter.ts`).
  The dashboard never imports raw UAPI/WHM details.
- Credentials: `CPANEL_HOST`, `CPANEL_USER`, `CPANEL_API_TOKEN` env vars.
  Never commit them (see root `.gitignore`).

## TODO

- [ ] Replace the in-memory project store with SQLite.
- [ ] Port allocation against `packages/supervisor/ports.registry`.
- [ ] Auth for the dashboard itself (it manages other people's backends).
- [ ] `npm install` + first `next dev` smoke test (deps declared, not installed).
