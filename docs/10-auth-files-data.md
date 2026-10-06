## Auth, data, and files: what PocketBase already solved

Auth

Email/password and OAuth providers configured per project in the PocketBase admin. Your control plane does not re-implement auth — it provisions the instance and hands the project owner the admin URL. Rule: the platform never sees end-user passwords.

Data

Collections are tables. SQLite handles thousands of rows comfortably; the failure mode is concurrent-write contention, which side-project traffic rarely reaches. Reach for MySQL (unlimited databases via UAPI) only for write-heavy or reporting workloads, accepting a second data system to back up. Semantic search is its own layer — see [§11](11-vector-rag.md).

### Files

Uploads land in `pb_data/storage` on the same 5 GB disk — so file storage is a quota conversation from day one. Per-project soft quotas enforced by a nightly `du` report in the control plane; hard enforcement is "the disk fills and everyone learns," which is why [§15](15-reseller-tier.md)'s per-account isolation matters commercially.

### Multi-tenancy inside one project

If a project itself serves multiple end-customers, model tenancy as a `tenant` collection with row-level API rules in PocketBase — application-level tenancy inside a project is a solved pattern. Infrastructure-level tenancy (one customer = one isolated backend) is the Reseller Tier in [§15](15-reseller-tier.md). Do not confuse the two layers in product copy.
