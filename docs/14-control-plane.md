## The control plane: the Coolify-style product itself

Everything above was manual. The product is the layer that makes it one click — that is what spreads.

### MVP feature set

| Feature | Backed by |
| --- | --- |
| Create project | UAPI: subdomain + MySQL (optional) + scaffold app dir + allocate port |
| Deploy | git pull / artifact unpack + health check (Sec. 12) |
| Env vars | Per-project .env rendered into start.sh |
| Domains + SSL status | UAPI addon domains + AutoSSL polling (Sec. 09) |
| Logs | Tail of project log files, rotated per Sec. 03 |
| Backup status | Litestream replica timestamp (Sec. 12) |
| Vector collections | sqlite-vec default; MySQL 8.0/9.0 options; HNSW scale exit (Sec. 11) |
| Usage | Nightly du + process RSS report per project |
| Suspend / resume | Stop watchdog + disable proxy (WHM suspend on reseller) |

### Where the control plane lives

Not on the $1.95 box: a small hosted instance drives many accounts over UAPI/WHM, surviving any one account's limits — the migration story in the next section.

### Product strategy: moat = experience; API = sanctioned

Wrapping UAPI/WHM is commodity — the defensible asset is feel: **5-minute onboarding** (connect a $2 account → live auth/DB/storage), a **dashboard that hides every cPanel-ism**, **one-click vector/RAG**, and **backup/restore non-technical users trust**. Coolify won on feel, not orchestration novelty. Risk is lower than it looks: cPanel & WHM runs a **Developer Portal with versioned API docs (v138), forums, and Discord** — this is a sanctioned integration path. Discipline: pin API versions, watch the changelog, keep raw UAPI behind an adapter (version bump = one-file change).

**Positioning:** “Coolify for the hosting you already have” — every $2 cPanel account is a prospect with zero new infrastructure to buy.
