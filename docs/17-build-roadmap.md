## Build log: the cPanel plan died, the VPS build happened

The four-week cPanel roadmap this section used to hold is history — it was written for a substrate that no longer exists. What follows is what was actually built, in order, with the evidence that gates each claim.

| When (EDT) | Built | Evidence |
| --- | --- | --- |
| 2026-10-07 ~00:40 | Docker data-plane decision: one PocketBase container per customer on a VPS we control; Caddy + auto-TLS; own 10-line PocketBase Dockerfile instead of trusting third-party images | Decision recorded with the reasoning (ToS risk gone on our own kernel) |
| 2026-10-07 ~19:20 | VPS call: "we're going to need a VPS to run the Docker, PocketBase" | His words, his call |
| 2026-10-07 ~19:25–19:35 | Deploy assets: `deploy/vps/` (compose, Caddyfile, gateway, `bin/provision`, `bin/deprovision`, `bin/backup`, `bin/poll-provision`), auth gateway (Bearer-key → token swap, 401/404 verified against mocks), Stripe billing bridge (`Subscription` + `ProvisionRequest` Prisma models, `/api/billing/webhook`, `/api/vps/requests`) | Committed locally; gateway smoke tests green |
| 2026-10-07 ~19:45 | VPS ordered: vps3695717.trouble-free.net, 66.23.224.55, InterServer 1-slice $3/mo price-locked, Ubuntu 24.04 | Panel confirmed; next invoice Nov 7 2026 |
| 2026-10-07 ~21:28–21:32 | Deploy completed via his SSH: `/srv/idb` live, Caddy + gateway up, pocketbase image built, backup + poller crons installed | `docker compose up -d --build` green on the box |
| 2026-10-07 ~21:35–21:42 | First provision failed twice (container user owned the volume as root; Caddy reload needed an explicit config flag; doubled serve args), fixes applied live on the box — then `bin/provision demo` succeeded | "— provisioned —", `https://demo.invisibledb.app`, API key at `/srv/idb/keys/demo.key` |
| 2026-10-07 ~23:55 | DNS cutover: `*.invisibledb.app` → 66.23.224.55 (customer instances), apex → Vercel (marketing site) | Cloudflare API, DNS-only, verified |
| 2026-10-07 late | E2E verified through the gateway: valid key → 200 PocketBase health, bad key → 401, TLS valid via Let's Encrypt | Observed, not assumed |
| 2026-10-08 ~01:00–01:15 | Control-plane audit fixes: `/projects` rewritten as the Your Databases dashboard (reads `ProvisionRequest`), legacy cPanel pages redirected, billing checkout loop fixed | Committed + pushed |
| 2026-10-08 ~01:35 | Stripe wired: product `prod_VOxrNECaDbKlsF` ("InvisibleDB"), price `price_1UO9wRADolYVlmkJHgCt9lcR` ($6.99/mo), coupon `FIRST_MONTH_1` ($5.99 off, once → first month $1) under the "Book Your Oil Change" account | Stripe dashboard, live objects |

Caveats, honestly: the box is ahead of GitHub — three provision fixes were applied live and committed locally but not pushed. `/api/vps/requests` was still 401ing for the poller at last check, and `VPS_API_SECRET` + `STRIPE_*` still need to land in Vercel env before the money flow runs end to end. Those are facts, not blockers on the log.

### What's left: the stranger golden-path test

The 1.0 launch gate is one end-to-end run by someone who is not us, with money attached:

1. Create an account at www.invisibledb.app
2. Pay $1 (Stripe Checkout with the first-month coupon)
3. Get provisioned — poller claims the `ProvisionRequest`, `bin/provision` runs, dashboard flips to done with endpoint + API key
4. CRUD through the SDK against their own `<slug>.invisibledb.app`
5. Cancel — `customer.subscription.deleted` fires, deprovision queue runs, final backup lands, container removed

Done when a stranger completes all five without our help and the evidence (webhook logs, provisioner report, dashboard state, final backup file) is on record. The Trust Stack rule applies to this roadmap too: no evidence, no green — and "launch" means the stranger's run, not our demo.
