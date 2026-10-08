## Auth, data, and files: what PocketBase already solved

### Auth

Email/password and OAuth providers configured per customer in their own PocketBase instance. The control plane does not re-implement auth — `bin/provision` creates the customer container, bootstraps the superuser, and hands the keys to the gateway. The platform key model is single-key per customer: one InvisibleDB API key (`idb_live_…`, stored 0600 in `/srv/idb/keys/`) → gateway swaps in the customer's PocketBase superuser token per request → proxies to that customer's container only.

Rule, unchanged and still load-bearing: **the platform never sees end-user passwords.** End-user auth happens inside the customer's instance; the gateway authenticates the *developer*, not the developer's users.

### Data

Collections are tables. SQLite handles thousands of rows comfortably; the failure mode is concurrent-write contention, which side-project traffic rarely reaches. There is no MySQL anymore — no second data system to configure, back up, or pay for. The fallback for a write-heavy workload is now a bigger envelope (bigger VPS, [§08](08-multi-tenant-pattern.md)), not a second database.

Semantic search is its own layer — see [§11](11-vector-rag.md).

### Files

Uploads land in the customer's volume (`idb-<slug>-data` mounted at `/pb/data`, storage inside it) — so file storage is a quota conversation from day one, just a different one: quotas are **per-volume**, not per-account-on-shared-disk. The control plane runs a nightly volume-size report per customer; soft quotas are enforced there. Hard enforcement is "the volume has no cap and the box disk fills," which is why the 02:00 backup and the disk tripwires in [§16](16-resource-budgets-limits.md) are not optional. Per-volume hard quotas are a known open item — sell the monitoring honestly until then.

### Multi-tenancy inside one customer

Two layers, and the product copy must not confuse them:

1. **Application-level tenancy** — a customer serving multiple end-users models tenancy as a `tenant` collection with row-level API rules in PocketBase. Solved pattern, inside their instance.
2. **Infrastructure-level tenancy** — one customer = one container + one volume. This *is* the product pattern ([§08](08-multi-tenant-pattern.md)), not a higher tier. The isolation a customer pays $6.99/month for is this layer.

The old framing split these across a Micro tier and a reseller tier. That framing died with shared hosting. Now there is one tenancy story, and the customer's $6.99 buys the whole thing.
