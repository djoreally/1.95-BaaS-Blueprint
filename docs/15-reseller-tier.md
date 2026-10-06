## The Reseller Tier: the real multi-tenant substrate

Micro mode is MacGyver mode — brilliant for proving the idea, wrong for selling it. The reseller account is where this stops being a hack and becomes a platform: every project or customer gets its own cPanel account, its own resource ceiling, and its own blast radius.

### The OrangeHost reseller ladder (as surfaced October 2026)

| Plan | Price | cPanel accounts | NVMe | Cost per account |
| --- | --- | --- | --- | --- |
| Spark | $19/mo | 25 | 30 GB | **$0.76** |
| Ignite | $39/mo | 50 | 60 GB | $0.78 |
| Radiate | $59/mo | 75 | 90 GB | $0.79 |
| Blaze | $78/mo | 100 | 120 GB | $0.78 |
| Flare | $98/mo | 125 | 150 GB | $0.78 |

All tiers: unlimited bandwidth, free SSL, email, MySQL, and addon domains. Per-account disk averages ~1.2 GB across the ladder — right-sized for a PocketBase project with disciplined file storage. Verify current pricing and account limits on the host's site before publishing numbers; plan names and prices change.

### Why reseller beats one shared account for the platform vision

|  | Single Micro account | Reseller (Spark+) |
| --- | --- | --- |
| Isolation | All projects share one CloudLinux LVE envelope | **Each cPanel account gets its own LVE limits** — CPU, RAM, IO, entry processes |
| Noisy neighbor | One runaway project starves every other project | One runaway project hits its own ceiling; neighbors unaffected |
| Disk | One 5 GB pool, shared fate | Per-account quota; a full disk hurts one tenant |
| Credentials | Everyone shares one account login model | Each tenant can receive real cPanel access to their own account |
| Suspension | Hand-edited proxy/watchdog tricks | WHM suspend/unsuspend — billing-grade off switch |
| Backups | Your Litestream discipline only | Per-account backups + your Litestream layer |

### The sentence that matters

On Micro, isolation is a convention you enforce. On reseller, isolation is a property of the substrate — CloudLinux enforces it whether your code is awake or not. Sellable multi-tenancy needs the second kind.
 — continued

## WHM API: the provisioning primitive

Reseller unlocks **WHM (Web Host Manager)** and its JSON API — the reseller-tier counterpart to UAPI. This is the API surface your control plane automates. The Coolify-style experience is, at bottom, a friendly UI over these calls:

| Platform action | WHM / UAPI primitive |
| --- | --- |
| Onboard a customer/project | WHM `createacct` with a package defining disk, bandwidth, and LVE-backed limits |
| Define seat tiers | WHM packages (e.g. Starter / Pro project templates) |
| Change a plan | WHM `changepackage` / account modification calls |
| Non-payment or abuse pause | WHM `suspendacct` / `unsuspendacct` |
| Inside the account: subdomain, DB, SSL, cron | Same UAPI calls as Micro mode — code you already wrote |
| Offboard | WHM `removeacct` after final backup export |

Authenticate with WHM API tokens scoped to the reseller, store them as platform secrets (never per-tenant), and log every provisioning call with its result — your audit trail is what separates a platform from a pile of scripts.
 — continued

## Economics and graduation

### Unit economics (planning math, your mileage will vary)

| Seat price | Substrate cost (Spark) | Gross margin per seat | 25 seats gross |
| --- | --- | --- | --- |
| $9/mo | $0.76 | $8.24 (92%) | $206 vs $19 cost |
| $19/mo | $0.76 | $18.24 (96%) | $456 vs $19 cost |

Even after payment processing and support, a $9–19 seat leaves very healthy margin: the substrate is priced for 2005 shared hosting, the experience for 2026 PaaS. That spread is the business — and it makes a real free tier affordable at $0.76 a seat.

### Competitive check: PocketHost ($9.99/mo per instance)

PocketHost charges **$9.99/mo per PocketBase instance** ($59.99/yr, $149.99 lifetime; 250 MB DB + 10 GB files per slot). Here: ~6 instances on Micro = **~$0.33 each** (~30x cheaper); Spark = **$0.76/tenant**. Different product: PocketHost sells managed ops on their infra; this sells the control plane over hosting the customer already pays for, with downloadable SQLite files — the anti-data-hostage position. Tradeoff: no managed ops/global ingress included; Sections 07, 12, and the restore drills close that gap.
 — continued

## Architecture shift and graduation

### How the architecture shifts between tiers

| Concern | Micro (single account) | Spark+ (reseller) |
| --- | --- | --- |
| Tenancy unit | Folder + port + subdomain | **Whole cPanel account** |
| Resource ceiling | Shared 1 CPU / 1 GB RAM | Per-account LVE package limits |
| Runtime | PocketBase instances sharing one account | One PocketBase/BaaS instance per account, same recipe |
| Proxying | .htaccess port proxy, collision registry | Same proxy pattern inside each account — ports can repeat per account |
| Backups | Litestream per project | Litestream per account + account-level options |
| Provisioning API | UAPI only | WHM (accounts/packages) + UAPI (inside accounts) |

### The migration path: Micro → Spark, one control plane

1. Start your own projects on the Micro box (Sections 03–12). Prove the recipe, build the control plane against UAPI.
2. Graduate: when a project outgrows shared RAM, earns revenue, or gains a paying customer, the control plane creates its cPanel account on Spark via createacct.
3. Move: deploy the same recipe in the new account, restore the Litestream stream, repoint DNS, verify health, retire the Micro instance.
4. Steady state: Micro is the free tier; Spark accounts are the paid seats. One dashboard throughout — the substrate changed, the product never did.

### Why this ordering wins

You validate demand at $1.95/month, and rent the $19 tier only when a tenant's growth — not your optimism — asks for it. UAPI works identically inside each reseller account, so the control plane carries across.
