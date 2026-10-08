## Vector search and AI memory: RAG on a $3 box

Every BaaS in 2026 gets asked the same question: "can it do semantic search?" On this stack the answer is yes — without Postgres, without pgvector, and without a second database server. You add a vector collection beside the data you already have.

### The position this blueprint takes

**Default: sqlite-vec** inside the customer's existing SQLite file. It fits the architecture you already run — one file per customer, the nightly backup already covers it, zero extra RAM, zero daemon. The **hybrid HNSW path is the scale exit** when a single customer outgrows brute-force scan. There are no MySQL paths in this document: there is no MySQL on the box, and vector search does not get to be the reason one appears.

On the substrate: `deploy/vps/pocketbase/Dockerfile.vec` carries the sqlite-vec custom build, and `bin/provision` selects it with `IDB_PB_IMAGE=idb-pocketbase:vec` — the same provisioning path, no special cases. Rollout is Phase 3; the design position is fixed now so nothing built on `:latest` has to be re-architected for `:vec`.

### What "connect" means when you are done

A customer exposes vector search the same way it exposes everything else: over HTTPS through the subdomain you already provisioned, authenticated by the InvisibleDB API key. No direct database port is opened to the internet — there is nothing to open; the database lives in a Docker volume behind the gateway.

| Consumer | How it connects | Auth |
| --- | --- | --- |
| Browser / mobile app | HTTPS `POST /api/search` on `<slug>.invisibledb.app` (gateway validates, proxies to the customer's container) | InvisibleDB API key (`Bearer idb_live_…`) |
| Server script / SDK | Same HTTPS endpoint, or the ZeroMemory agent interface (`docs/agents.md`) | Same API key, via env var |
| Control plane | Creates the collection, stores embedding-model config per customer, shows doc/vector counts | Superuser path, server-side only |

```
// Minimal client shape (any language, same idea)
POST https://acme.invisibledb.app/api/search
Authorization: Bearer idb_live_abc123…
{ "query": "how do refunds work?", "collection": "docs", "k": 5 }
// -> { "results": [{ "id": "...", "content": "...", "distance": 0.21 }] }
```

Embedding generation itself is an outbound HTTPS call (OpenAI, Cohere, Voyage, or a hosted open model) from the customer's PocketBase hook — the $3 box never runs a transformer. At 1 vCPU that is a constraint to design around, not a gap to apologise for: generation is rented, storage and retrieval are owned. Cache embeddings on write; never re-embed unchanged content.

### Recommended default: sqlite-vec in the customer file

```sql
-- Inside the customer's data.db — ships with the file the backup already covers
CREATE VIRTUAL TABLE vec_docs USING vec0(
  embedding float[1536]
);
-- App code inserts the rowid + vector; payload stays in a normal table
SELECT rowid, distance FROM vec_docs
WHERE embedding MATCH ? AND k = 5 ORDER BY distance;
```

Why this wins on this substrate: no new server, no new daemon, works identically for every customer because every customer is one file, and it restores with the database. The `:vec` image loads the extension in the PocketBase process.

### Control-plane surface for vectors

Per customer: embedding model + dimensions (config, never hardcoded), collection list with vector counts, a "test query" box calling the customer's own endpoint, and the same backup story as the rest of the data ([§12](12-backups-maintenance.md)). Dimension changes are a new collection, never an in-place alter.

### From scan to index: the scale path

| Strategy | Speed | Comfortable scale | Best for |
| --- | --- | --- | --- |
| **sqlite-vec (default)** | Fast for size | ~10k–100k vectors per customer | The blueprint's standard customer |
| Hybrid: store in DB + in-memory HNSW | Very fast (< 10 ms) | Millions | The scale exit (below) |

sqlite-vec gives exact scan, not ANN. When latency stops being acceptable, add an index in front of the data — do not migrate it:

1. Store relational data and full payload vectors in the customer's SQLite file (source of truth, backed up as always).
2. Build an in-memory HNSW index in the customer's own container (Go usearch, Python hnswlib as a sidecar in the same 256 MB envelope), loaded from the database on boot.
3. Query the in-memory index for vector IDs, then hydrate: `SELECT ... WHERE id IN (...)` for content, permissions, and tenant filtering.

Frontend contract unchanged: same `/api/search` endpoint. The HNSW index lives inside the customer's container, so the customer's memory envelope ([§08](08-multi-tenant-pattern.md)) is the honest budget for it — a customer needing millions of vectors is a customer whose envelope conversation has already happened.

### Decision: PostgreSQL stays out

Postgres was evaluated twice and ruled out both times. The old substrate had a fenced-off, unusable install; on this substrate we *could* run it — but pgvector would add a second data system per customer, a second backup path per customer, and RAM the $3 box does not have, all to solve a problem sqlite-vec already solves inside the one file each customer owns. The vector ladder stays: **sqlite-vec (default) → hybrid HNSW scale exit.** Revisit only when a customer's envelope, not the substrate, demands it.
