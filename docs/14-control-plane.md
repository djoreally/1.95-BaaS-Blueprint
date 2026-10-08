## The control plane: the Coolify-style product itself

Everything above was manual. The product is the layer that makes it one click — that is what spreads.

### MVP feature set

| Feature | Backed by |
| --- | --- |
| Create database | Stripe Checkout → `checkout.session.completed` webhook → `Subscription` row + `ProvisionRequest` row → VPS poller claims it every 2 minutes → `bin/provision` |
| Your Databases dashboard (`/projects`) | Reads the user's `ProvisionRequest` rows (pending / done); done rows show the endpoint URL and an SDK connect snippet |
| API keys | Issued at provision time into `/srv/idb/keys/<slug>.key` (0600); shown to the customer once in the dashboard, then never displayed again |
| Auth gateway | Node service on the box between Caddy and PocketBase: validates `Authorization: Bearer <apiKey>`, swaps in the customer's PocketBase token, proxies to the right container ([§18](18-reference.md)) |
| Domains + SSL status | Caddy auto-TLS per `<slug>.invisibledb.app` — issued on first request, renewed automatically; the dashboard reads cert state, not cPanel AutoSSL |
| Logs | Per-container `docker logs idb-<slug>` (tailed on demand; not stored on the box — volume stays small) |
| Backup status | Nightly `bin/backup` run (online `sqlite3 .backup` + retention + off-box rsync); the dashboard shows the last backup timestamp per customer |
| Vector collections | sqlite-vec compiled into the PocketBase image; MySQL and HNSW scale exits still stand ([§11](11-vector-rag.md)) |
| Usage | Nightly volume size + container RSS per customer; reported per seat |
| Billing | Stripe customer portal (self-serve invoices, card changes); the platform's only billing surface |
| Suspend / deprovision | `customer.subscription.deleted` webhook → deprovision queue → `bin/deprovision` (final backup first, then volume + container + route removed) |

### Where the control plane lives

Not on the $3 box: the control plane is a Next.js app on Vercel at www.invisibledb.app, with its state in Postgres on Neon (Prisma: `Subscription`, `ProvisionRequest`). The box never talks to Stripe and never holds billing secrets — the VPS poller authenticates to the control plane with a single shared secret (`VPS_API_SECRET`) and claims/report work through `/api/vps/requests`. The substrate can burn down and the business records survive: customer rows, subscriptions, and audit trail live in Neon, customer *data* lives in per-customer SQLite volumes with off-box backups.

`/admin` is the super-admin surface: integrations status (Stripe keys, webhook secret, VPS reachability — HTTPS up / host up / unreachable, Neon liveness), the provision queue, and the backup ledger. This is the "what is live?" room from [§13](13-deployment-pipeline.md).

### Product strategy: moat = experience + the agent interface

Wrapping shared-hosting APIs is dead — the defensible asset is feel: **5-minute onboarding** (email → pay $1 → provisioned database with a copy-paste snippet), a **dashboard that hides every Docker-ism**, **one-click vector/RAG** via native sqlite-vec, and **backup/restore a non-technical user can trust**. And now the second moat: the **agent interface**. Firebase gives agents a database; this gives them a memory and a conscience — ZeroAI (ZeroMemory/ZeroLedger/ZeroPolicy/ZeroGate/ZeroCert) over an MCP server, the `idb` CLI, and JS + Dart SDKs. Coolify won on feel, not orchestration novelty; the agent-native backend layer is this product's version of that bet.

**Positioning:** "invisible backend for indie devs who fear the Firebase bill" — email in, isolated secure SQLite in the cloud, auth + files + vector embeddings handled natively. One snippet, one API key in an env var, back to building app features. The data-freedom edge survives the pivot intact: the database is a file, and it is theirs.
