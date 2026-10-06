## Vector search and AI memory: RAG on a $2 box

Every BaaS in 2026 gets asked the same question: “can it do semantic search?” On this stack the answer is yes — without Postgres, without pgvector, and without a second database server. You add a vector collection beside the data you already have.

### The position this blueprint takes

**Default: sqlite-vec** inside the project’s existing SQLite file. It fits the architecture you already run — one file per project, Litestream already backs it up, zero extra RAM, zero daemon. **MySQL paths below are the fallback** when the payload already lives in MySQL or the team wants SQL-only. The **hybrid HNSW path is the scale exit** when a single project outgrows brute-force scan. MySQL 9.0 native `VECTOR` is documented for completeness — verify your host actually runs 9.0 before designing on it; most shared hosts run MySQL 8.0 or MariaDB.

### What “connect” means when you are done

A project exposes vector search the same way it exposes everything else: over HTTPS through the subdomain you already provisioned. No direct MySQL port is opened to the internet (shared hosting does not give you one you should use, and you would not want it). Frontends and scripts connect in three sanctioned ways:

| Consumer | How it connects | Auth |
| --- | --- | --- |
| Browser / mobile app | PocketBase REST + a custom hook endpoint, e.g. `POST /api/search` on `project.yourdomain.com` | PocketBase user token (Bearer) |
| Server script / cron job | Same HTTPS endpoint, or direct file access over SSH on the box | Admin token or SSH key |
| Control plane | Creates the collection, stores embedding-model config as env vars, shows doc/vector counts | UAPI + project admin API |

```
// Minimal client shape (any language, same idea)
POST https://myapp.yourdomain.com/api/search
Authorization: Bearer <user-token>
{ "query": "how do refunds work?", "collection": "docs", "k": 5 }
// -> { "results": [{ "id": "...", "content": "...", "distance": 0.21 }] }
```

Embedding generation itself is an outbound HTTPS call (OpenAI, Cohere, Voyage, or a hosted open model) from the PocketBase hook — the shared box never runs a transformer. At 1 GB RAM that is a constraint to design around, not a gap to apologise for: generation is rented, storage and retrieval are owned. Cache embeddings on write; never re-embed unchanged content.

### First, check what your MySQL actually is

```sql
SELECT VERSION();  -- e.g. 8.0.x or 10.x-MariaDB decides which options exist
SHOW VARIABLES LIKE 'version%';
```

Run this in phpMyAdmin before choosing a path. MySQL 9.0+ unlocks Option A. MySQL 8.0 / MariaDB means Option B or C (or sqlite-vec, which does not care). MariaDB 10.7+ has its own `VECTOR` type and distance functions on some builds — treat it as “verify on your host,” not as a promise.
 — continued

## Three MySQL paths, one default, one scale exit

### Recommended default (not MySQL): sqlite-vec in the project file

```sql
-- Inside pb_data/data.db — ships with the file Litestream already replicates
CREATE VIRTUAL TABLE vec_docs USING vec0(
  embedding float[1536]
);
-- App code inserts the rowid + vector; payload stays in a normal table
SELECT rowid, distance FROM vec_docs
WHERE embedding MATCH ? AND k = 5 ORDER BY distance;
```

Why this wins on shared hosting: no new server, no stored-procedure permissions to negotiate, works identically on Micro and per-account reseller seats, and restores with the database. Load the extension from the PocketBase process or a small Go/Python sidecar — see the hybrid note below if you outgrow it.
 — continued

## MySQL native and 8.0 paths

### Option A — MySQL 9.0+ native VECTOR (when the host truly runs 9.0)

```sql
CREATE TABLE embeddings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  document_id VARCHAR(255) NOT NULL,
  content TEXT,
  embedding VECTOR(1536) NOT NULL  -- match model dims (e.g. 1536)
);
INSERT INTO embeddings (document_id, content, embedding) VALUES (
  'doc_001', 'PocketBase is a single-binary backend solution.',
  STRING_TO_VECTOR('[0.012, -0.045, 0.321, ...]')
);
SELECT document_id, content,
  DISTANCE(embedding, STRING_TO_VECTOR('[0.015, -0.040, 0.310, ...]'), 'COSINE') AS distance
FROM embeddings ORDER BY distance ASC LIMIT 5;
```
 — continued

## MySQL 8.0: the shared-hosting workhorse

### Option B — MySQL 8.0: JSON storage + pure-SQL cosine (the shared-hosting workhorse)

Exact nearest-neighbour by table scan. Slow, honest, and entirely sufficient for prototypes and small corpora. Store the JSON, create the function once per database:

```sql
CREATE TABLE embeddings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  document_id VARCHAR(255) NOT NULL,
  content TEXT,
  vector_json JSON NOT NULL
);

DELIMITER //
CREATE FUNCTION COSINE_DISTANCE(a JSON, b JSON)
RETURNS DOUBLE DETERMINISTIC
BEGIN
  DECLARE i INT DEFAULT 0; DECLARE len INT;
  DECLARE dot_product DOUBLE DEFAULT 0.0;
  DECLARE norm_a DOUBLE DEFAULT 0.0; DECLARE norm_b DOUBLE DEFAULT 0.0;
  DECLARE val_a DOUBLE; DECLARE val_b DOUBLE;
  SET len = JSON_LENGTH(a);
  WHILE i < len DO
    SET val_a = CAST(JSON_EXTRACT(a, CONCAT('$[', i, ']')) AS DOUBLE);
    SET val_b = CAST(JSON_EXTRACT(b, CONCAT('$[', i, ']')) AS DOUBLE);
    SET dot_product = dot_product + (val_a * val_b);
    SET norm_a = norm_a + (val_a * val_a);
    SET norm_b = norm_b + (val_b * val_b);
    SET i = i + 1;
  END WHILE;
  IF norm_a = 0 OR norm_b = 0 THEN RETURN 1.0; END IF;
  RETURN 1.0 - (dot_product / (SQRT(norm_a) * SQRT(norm_b)));
END //
DELIMITER ;

SELECT document_id, content,
  COSINE_DISTANCE(vector_json, '[0.012, -0.045, 0.321, ...]') AS distance
FROM embeddings ORDER BY distance ASC LIMIT 5;
```
 — continued

## Running it on shared hosting

Shared-hosting caveats: stored functions may require `CREATE ROUTINE` privilege — if the host denies it, the same math moves into app code over fetched rows (Option C), no schema change. Always pre-filter (`WHERE tenant / collection`) before scanning.

### Control-plane surface for vectors

Per project: embedding model + dimensions (env vars, never hardcoded), collection list with vector counts, a “test query” box calling the project’s own endpoint, and the same backup story as the rest of the data. Dimension changes are a new collection, never an in-place alter.
 — continued

## From scan to index: the scale path

### Option C — Normalised vectors in a BLOB + dot product (the fast SQL-adjacent path)

When embeddings are pre-normalised (|v| = 1, standard for OpenAI/Cohere output), cosine similarity *is* the dot product: no norms, no division. Pack float32 arrays into a `BLOB` at the language layer (Go `binary.Write`, Python `struct.pack`), store it beside the payload, and compute the dot product in app code over candidate rows. MySQL stays the durable store; arithmetic happens where it is cheap — the bridge to the hybrid design below.

| Strategy | Speed | Comfortable scale | Best for |
| --- | --- | --- | --- |
| **sqlite-vec (default)** | Fast for size | ~10k–100k vectors per project | The blueprint’s standard project |
| MySQL 9.0 native VECTOR | Moderate | ~100k vectors | Hosts verified on 9.0; simple built-in RAG |
| MySQL 8.0 JSON + stored proc | Slow (table scan) | < 10k vectors | Prototyping, low-data side projects, SQL-only teams |
| BLOB + app-layer dot product | Faster than JSON scan | ~10k–50k with pre-filtering | Normalised embeddings, MySQL payload already exists |
| Hybrid: store in DB + in-memory HNSW | Very fast (< 10 ms) | Millions | The scale exit (below) |

### The scale exit: hybrid architecture (production pattern)

MySQL/SQLite give exact scan, not ANN (HNSW/IVFFlat). When latency stops being acceptable, add an index in front of the data — do not migrate it:

1. Store relational data and full payload vectors in MySQL/SQLite (source of truth, backed up as always).
2. Build an in-memory HNSW index in the backend process (Go usearch, Python hnswlib) loaded from the database on boot.
3. Query the in-memory index for vector IDs, then hydrate: SELECT ... WHERE id IN (...) for content, permissions, and tenant filtering.

On Micro this is a per-project opt-in inside the 1 GB ceiling; on reseller it gets its own LVE envelope. Frontend contract unchanged: same `/api/search` endpoint.

## Measured finding: PostgreSQL on OrangeHost Micro (2026-10-05)

cPanel exposes a PostgreSQL Databases UI and `psql` 16.15 client exists on the box, with a server process answering on TCP 5432 — but it is **not usable from user accounts**:

- `pg_hba.conf` rejects all TCP connections from cPanel users (`no pg_hba.conf entry for host "::1"/"127.0.0.1"`, no-encryption entries only); the server does not support SSL, so there is no TCP path without root access to edit pg_hba.
- The Unix socket path is a dangling symlink: `/tmp/.s.PGSQL.5432 -> /var/run/postgres/.s.PGSQL.5432`, and `/var/run/postgres/` does not exist. No live socket exists anywhere under /tmp or /var/run.
- The cPanel UI will create databases/users that can never be connected to.

**Decision:** PostgreSQL/pgvector stays OUT of the substrate options. The vector ladder remains sqlite-vec (default) → MySQL fallbacks → hybrid HNSW scale exit. Revisit only if the host opens pg_hba or fixes the socket.
