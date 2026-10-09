# InvisibleDB Migration Engine

InvisibleDB supports both local stdio MCP and hosted Streamable-HTTP-style MCP at `https://www.invisibledb.app/api/mcp`. A hosted client (including Lovable-compatible remote MCP connectors) can use the HTTPS endpoint with an `Authorization: Bearer idb_sk_...` header. API keys are created in **Dashboard → API keys** and shown once.

The migration engine is agent-orchestrated and runtime-executed. An MCP-capable agent reads the source backend (Lovable Cloud/Supabase/Postgres), builds a neutral manifest, asks InvisibleDB to compile it, then streams bounded batches. The LLM plans and supervises; InvisibleDB performs deterministic transforms and writes.

## Lovable → InvisibleDB golden path

1. Connect Lovable and InvisibleDB MCP to the same agent. InvisibleDB can be local stdio or the hosted `/api/mcp` URL.
2. Call `idb_migration_manifest_spec`.
3. Run the returned **read-only** introspection SQL against Lovable Cloud/Postgres.
4. Build `MigrationManifest v1.0`; never invent missing schema facts.
5. `idb_migration_plan` returns compatibility, warnings and blockers without mutation.
6. Provision/select an InvisibleDB instance.
7. `idb_migration_create` persists the manifest and compiled plan.
8. `idb_migration_start` queues a pre-migration destination backup.
9. After backup completion, `idb_migration_prepare` creates collections in two passes and resolves relations.
10. Paginate source rows and stream `idb_migration_batch` in batches of 1-500 rows with stable `batchKey`s.
11. Stream identities with `idb_migration_auth_batch`.
12. Transfer storage using `idb_migration_file` with signed HTTPS URLs; bytes flow source→InvisibleDB, not through the model context.
13. `idb_migration_verify` requires exact expected/imported row counts and zero failed batches. Unresolved RLS/functions/extensions yield `PARTIAL` and block cutover.
14. `idb_migration_cutover` only succeeds when evidence is `VERIFIED`.
15. Keep source read-only during the rollback window; `idb_migration_rollback` queues restoration from the pre-migration backup.

## Migration Manifest v1.0

The source adapter provides provider/engine/capture time, tables, columns, primary keys, foreign keys, indexes, RLS policies and triggers. Optional sections cover auth, storage, functions, realtime and Postgres extensions. The manifest is provider-neutral: Lovable is the first source, not a hard-coded dependency.

## Identity translation

PocketBase record IDs are generated deterministically from `(source table, source primary key)` using SHA-256 and truncated to a valid 15-character ID. Every migrated record receives `_source_id`. Foreign keys use the same deterministic transform, avoiding an unbounded in-memory ID map.

## Compatibility compiler

- text/varchar/uuid → text
- numeric families → number
- boolean → bool
- timestamp/date/time → date
- json/jsonb/arrays → json
- enums → select
- foreign keys → relation
- pgvector → sqlite-vec path
- common `auth.uid()` owner RLS → PocketBase request-auth rules
- complex subquery/JWT/EXISTS policies → locked destination rules + cutover blocker
- unrecognized triggers/functions/extensions → cutover blocker

Staging is allowed with blockers because untranslated destination access rules remain closed. Cutover is not.

## Auth

Password hashes are never copied into ordinary fields. When portable password continuity is unavailable, identities/profile state migrate and records are marked `migration_reset_required`; the migration reports that users need password reset or OAuth re-link.

## Storage safety

Remote file import requires HTTPS, rejects localhost/private-network literal hosts, caps one object at 25 MB, and can verify SHA-256 before upload.

## Supabase compatibility path

The JavaScript SDK exposes `invisibledb/supabase`, a transition adapter implementing common `createClient`, `from(...).select/insert/update/upsert/delete`, filters, single/maybeSingle, and password-auth calls. This is a bridge for Lovable/Supabase code; native InvisibleDB SDK usage remains the long-term target.

## Evidence rule

No successful HTTP response proves migration correctness. `VERIFIED` is the only passing state. `PARTIAL`, `FAILED`, and `UNKNOWN` block cutover.
