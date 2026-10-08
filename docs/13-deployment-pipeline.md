## Two deploy tracks: control plane and VPS runtime

There is no single deploy button because there are two things to ship: the product's web UI, and the box that runs customers' databases. They move on separate tracks with separate rollback stories.

### Track A — control plane (Next.js on Vercel)

The control plane lives at www.invisibledb.app and deploys from GitHub via Vercel. **Auto-deploys are disabled** — a push does not ship by itself. A deploy is a deliberate act: Vercel dashboard → Deployments → pick the commit → Redeploy/Promote. This is by choice, not neglect: the person holding the dashboard also holds the env vars and the Stripe account, so nothing goes live without him seeing it.

The pipeline discipline survives the move from SSH to Vercel:

1. Build and review on a branch. Merge only on his word (the default is branch-for-review).
2. Deploy manually from the dashboard. Confirm the deployment ID matches the commit you intended — a redeploy of an old commit ships old code, and the honest fix is to check the SHA before claiming live.
3. Verify the "what is live?" answer: the deployment ID, commit SHA, and timestamp are visible in the Vercel dashboard and mirrored in the control plane's own status views ([§14](14-control-plane.md)). No evidence, no green — "deployed" means observed serving, not pushed.

Env-var discipline: the control plane needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_FIRST_MONTH_COUPON_ID`, `VPS_API_SECRET`, and the Neon `DATABASE_URL` in Vercel Production. A new env var is announced where it must be created *before* it is depended on — the Oct 7 lesson was him having to ask for variable names.

### Track B — VPS runtime (compose in /srv/idb)

The box (vps3695717, 66.23.224.55) is not redeployed per customer — customers are *provisioned* on it. Runtime deploys are the rare events: rebuilding the PocketBase image, updating the gateway, changing the Caddyfile. The working surface is `/srv/idb` ([§18](18-reference.md)):

```bash
# runtime deploy (sketch)
cd /srv/idb
docker tag idb-pocketbase:latest idb-pocketbase:prev     # keep the way back
docker compose up -d --build                            # rebuild gateway/caddy; pocketbase image built separately
docker build -t idb-pocketbase:latest ./pocketbase       # only when PocketBase itself changes
curl -sf https://<healthz through the gateway> || ./bin/rollback  # see below
```

Safe-swap discipline carries over from the old binary days: the previous PocketBase image stays tagged as `idb-pocketbase:prev` so rollback is one command, not a rebuild:

```bash
# rollback: retag, recreate, re-check
docker tag idb-pocketbase:prev idb-pocketbase:latest
docker compose up -d --force-recreate gateway
curl -sf http://127.0.0.1:8090/_/   # through the gateway's /healthz path
```

Health-check before declaring green: the gateway's `/healthz` plus a PocketBase `/api/health` through one real customer route. Customers' containers are never touched by a runtime deploy — their volumes persist and their containers are recreated only against images, never rebuilt in place.

Provisioning is deliberately *not* part of either deploy: `bin/provision <slug> <email>` runs on the box (or via the 2-minute poller picking up a `ProvisionRequest` row), writes the Caddy route, and reloads Caddy. A customer going live is a data-plane event, recorded in the control plane as the row's status flip to `done` — which keeps "what is live?" answerable for the *business*, not just the code.
