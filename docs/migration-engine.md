# InvisibleDB Migration Engine

InvisibleDB supports local stdio MCP and a hosted stateless HTTP MCP endpoint at `https://www.invisibledb.app/api/mcp`. Hosted clients authenticate with `Authorization: Bearer idb_sk_...`. Control-plane keys are created in **Dashboard → API keys**, shown once, stored hashed, revocable, and scoped to databases owned by that account.

The migration engine is agent-orchestrated and runtime-executed. The model discovers, plans, translates, and supervises; deterministic server code performs schema creation, batching, file transfer, verification, cutover gating, and rollback.

## Lovable → InvisibleDB golden path

1. Connect Lovable and InvisibleDB MCP to the same agent.
2. Call `idb_migration_manifest_spec`.
3. Run its read-only discovery SQL against Lovable Cloud/Postgres.
4. Treat `estimated_rows` as discovery only. Run every generated `COUNT(*)` statement and place only exact values in `manifest.tables[].rowCount`.
5. Build MigrationManifest v1.0. Combine schema + relation names (for example `public.customers` and `auth.users`) consistently across tables and foreign keys.
6. Call `idb_migration_plan`. This is read-only and returns compatibility, warnings, cutover blockers, and hard blockers.
7. Hard blockers—missing/composite stable identity, non-PK relation identity, destination-name collisions, invalid auth mapping—must be corrected in the manifest before staging.
8. `idb_migration_create` persists the reviewed manifest/plan.
9. `idb_migration_start` creates exactly one pre-migration backup. Retries reuse the original snapshot instead of replacing rollback evidence with a partially migrated database.
10. After backup completion, `idb_migration_prepare` creates collections in two passes, resolves relations, and applies supported indexes.
11. Paginate source rows and stream `idb_migration_batch` in stable 1–500 row batches. Batch keys and deterministic destination IDs make retries idempotent.
12. Stream identities with `idb_migration_auth_batch`. Source password hashes are never copied into ordinary fields; when password continuity is unavailable, records are marked for reset. Confirmed Supabase/Lovable users preserve verification state.
13. For Supabase/Lovable Storage, stage one metadata record per object in the generated storage collection, then call `idb_migration_file` with a signed HTTPS URL. File bytes never enter the model context.
14. Unsupported RLS, functions, views, triggers, extension behavior, and storage call-site changes remain cutover blockers. After the agent actually rewrites/tests one, `idb_migration_resolve` records concrete evidence and clears that blocker. Hard blockers cannot be cleared this way.
15. `idb_migration_verify` compares exact source counts, successful import-ledger counts, live destination counts, actual attached-file counts, failed batches, and unresolved blockers. Missing evidence is `PARTIAL`, never success.
16. `idb_migration_cutover` only succeeds with `VERIFIED` evidence and zero blockers.
17. Keep the source backend read-only during the rollback window. `idb_migration_rollback` restores the captured pre-migration `.db.gz` snapshot automatically.

## Migration Manifest v1.0

The neutral source contract includes:

- provider, engine, source project id, capture time
- tables/views/materialized views
- exact row counts
- columns/types/defaults
- primary and foreign keys
- indexes
- RLS policies
- triggers
- auth metadata
- storage buckets and exact object counts
- functions/RPCs/edge-function inventory
- realtime inventory
- database extensions

Lovable is the first adapter, not a special case in the destination runtime. The same manifest/compiler path is intended for Supabase and generic Postgres next.

## Identity and relation translation

Destination record IDs are SHA-256-derived from `(source table, source primary key)` and truncated to PocketBase's 15-character ID format. `_source_id` preserves the original identity. Relations reuse the same deterministic transform.

That only works automatically for one stable source primary key and foreign keys pointing to that primary key. Composite keys, keyless tables, and FKs targeting a different unique column are hard blockers because guessing would risk collisions or wrong relations.

## Postgres → PocketBase/SQLite compiler

- text/varchar/uuid → text
- numeric families → number
- boolean → bool
- timestamp/date/time → date
- json/jsonb/arrays → json
- enums → select
- simple foreign keys → relation
- simple/unique indexes → PocketBase indexes
- pgvector → sqlite-vec path
- common `auth.uid()` owner RLS → PocketBase request-auth rules
- complex subquery/JWT/EXISTS RLS → locked rules + blocker
- views/materialized views → blocker until materialized/rewritten intentionally
- nonliteral database defaults → warning/rewrite to application/runtime logic
- custom triggers/functions/extensions → blocker unless specifically translated

Collections with untranslated access policy stay closed while data is staged.

## Storage model

Supabase buckets do not map one-to-one to PocketBase because PocketBase files are record-attached. The compiler generates a storage collection containing `bucket`, `path`, `metadata`, `file`, and `_source_id`, with a unique bucket/path index. Application bucket API calls remain a blocker until rewritten.

Remote file import:

- HTTPS only
- standard port only
- no URL credentials
- public DNS/IP validation
- manual redirect validation on every hop
- 25 MB per-object limit in the current implementation
- optional SHA-256 verification
- verification counts records with a real file attached, not only metadata rows

## Auth and browser cutover

The gateway has two credential lanes:

- `idb_live_*` instance server key → privileged management/server lane
- normal PocketBase user token or no token → public lane governed by collection rules

**Never put the instance server key in Lovable/browser code.** Safe cutover returns the public base URL and migrated auth-collection name. The JavaScript SDK exposes `invisibledb/supabase` as a transition adapter for common Supabase-style CRUD and password-auth calls. The adapter uses end-user auth tokens, not the privileged instance key.

Server-only jobs can fetch the management key with `idb_keys` and must keep it in server-side secret storage.

## Evidence model

`VERIFIED` is the only passing state. `PARTIAL`, `FAILED`, and `UNKNOWN` block cutover.

Verification requires all applicable evidence:

- exact source counts
- imported batch counts
- live destination counts
- actual attached storage files
- no failed batches
- no unresolved cutover blockers
- no hard blockers

A successful HTTP response is never treated as proof of migration correctness.

## Rollback model

The first migration start queues an online SQLite backup through the existing VPS runtime. Preparation refuses to mutate schema until the backup command completed and the expected `<slug>-YYYY-MM-DD-HHMMSS.db.gz` filename can be extracted as evidence. Later retries reuse that same snapshot. Rollback restores only that validated filename (or an explicitly supplied validated override).

## Supabase compatibility bridge

`invisibledb/supabase` currently covers common migration-friendly surface area:

- `createClient`
- `.from(...).select()`
- insert/update/upsert/delete
- eq/neq/gt/gte/lt/lte/like/ilike
- order/limit
- single/maybeSingle
- password sign-in, sign-out, session/user helpers

Storage, RPC/functions, advanced realtime/channels, and provider-specific auth flows are intentionally not faked. The migration planner exposes them as rewrite work so the agent can convert them explicitly rather than silently changing behavior.
