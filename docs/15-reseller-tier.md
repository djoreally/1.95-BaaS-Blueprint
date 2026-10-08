## Unit economics and scaling the VPS model

The reseller ladder is dead. There is no Spark, no WHM, no `createacct` — the cPanel model was evaluated, priced at $19/mo for 25 accounts, and rejected. The substrate is one InterServer VPS slice (vps3695717.trouble-free.net, 66.23.224.55): 1 vCPU, 2 GB RAM, 40 GB SSD, **$3/mo price-locked**, running Docker. Every customer gets a PocketBase container, an isolated SQLite volume at `/srv/idb`, a Caddy route with auto-TLS, and an API key. Provisioning is a shell script, not a hosting-panel API call.

### The math

| Seats | Substrate cost | Revenue at $6.99/seat | Substrate per seat |
| --- | --- | --- | --- |
| 1 | $3/mo | $6.99 | $3.00 |
| 10 | $3/mo | $69.90 | $0.30 |
| 25 | $3/mo (slice upgrade ~$6–12) | $174.75 | ~$0.24–0.48 |

Per-customer marginal cost is near zero: a PocketBase container idles at roughly 30–60 MB of RAM, so the 2 GB slice holds on the order of 10–15 light customers before RAM is the binding constraint. First month is $1 (coupon `FIRST_MONTH_1`: $5.99 off once), then $6.99/mo recurring. At scale the substrate lands well under a dollar per seat — roughly a **9x margin** on the box alone, before Stripe fees and support time. This is the same shape as the old reseller math with none of the WHM machinery.

### Why per-customer containers beat per-customer cPanel accounts

|  | cPanel account per tenant (dead model) | Container per tenant (live model) |
| --- | --- | --- |
| Provisioning primitive | WHM `createacct` — a hosting-panel API with its own failure modes and audit burden | `bin/provision <slug> <email>` — one script, idempotent, logged |
| Isolation | CloudLinux LVE envelope per account | Docker: per-container CPU/RAM limits, own filesystem, own network namespace |
| Density | ~1.2 GB disk quota per account on the ladder; 25 accounts per $19 tier | One 2 GB box holds ~10–15 containers; density is RAM-bound, not quota-bound |
| Overhead per tenant | A full cPanel account (mail, MySQL, addon domains — all unused by this product) | One volume + one container; nothing else exists |
| Upgrade path | Move account to a bigger reseller tier; migrate data between accounts | `docker compose` on a bigger slice; or a second box (below) |
| ToS risk | Persistent processes and binaries on shared hosting — the existential risk that killed this model | Our box, our kernel, our rules — ToS problem gone |

### The capacity ladder: when to grow

| Stage | Box | When to move |
| --- | --- | --- |
| **1 — single slice** | 1 vCPU / 2 GB / 40 GB, $3/mo | Now. RAM is the binding constraint (~10–15 customers). |
| **2 — bigger slice** | 2–4 vCPU / 4–8 GB, still one provider | Resident memory across containers approaches 70% of RAM, or disk past 70% after backups are pruned off-box. Adding a slice roughly doubles resources at the same provider. |
| **3 — multi-box** | N slices behind one Caddy fleet (or any L7 edge) | One box's failure domain is the customer's blast radius: when "the box is down" must never mean "all customers are down." The control plane already abstracts provisioning per box ([§14](14-control-plane.md)); the poller model extends to box N by giving each box its own secret and claim namespace. |

### Architecture shifts between stages

| Concern | Single VPS | Bigger VPS | Multi-VPS |
| --- | --- | --- | --- |
| Tenancy unit | Container + volume | Container + volume | Container + volume |
| Resource ceiling | 2 GB shared across containers | Bigger slice, same limits-per-container | Per-box pools; placement policy in the control plane |
| Runtime | One PocketBase image, N containers | Same image, more headroom | Same image on every box — the recipe never changes |
| Routing | Caddy on the box, `*.invisibledb.app` wildcard | Same | Caddy per box (or one edge Caddy) with per-box host routing |
| Backups | Nightly `bin/backup` + off-box rsync | Same, plus retention tightening as volume count grows | Per-box backup ledgers aggregated in `/admin` |
| Provisioning | Poller claims rows every 2 min | Same | Pollers per box claim from a shared queue |

### The sentence that matters

On shared hosting, isolation was a convention you enforced against a landlord's rules. On this box, isolation is a property of the substrate — Docker enforces it whether your code is awake or not. Sellable multi-tenancy needs the second kind, and now the second kind costs $3 a month.

### Competitive check: PocketHost ($9.99/mo per instance)

PocketHost charges **$9.99/mo per PocketBase instance** (250 MB DB + 10 GB files per slot). Here: ~10 customers on one $3 slice = **~$0.30 of substrate each**, sold at $6.99 — ~30% cheaper for the customer than PocketHost at ~9x margin for us. Different product, same as before: PocketHost sells managed ops on their infra; this sells the one-click experience plus the agent interface (MCP, `idb` CLI, JS + Dart SDKs) with downloadable SQLite files — the anti-data-hostage position. Tradeoff, honestly stated: no managed ops team and no global ingress beyond Caddy on our boxes; [§16](16-resource-budgets-limits.md) and the backup/restore drills are what close that gap.
