# InvisibleDB Migration Engine

The migration engine is agent-orchestrated and runtime-executed. An MCP-capable agent can read a source backend (Lovable Cloud/Supabase/Postgres), build a neutral manifest, ask InvisibleDB to compile it, then stream bounded batches. The LLM plans and supervises; InvisibleDB performs deterministic transforms and writes.

## Golden path

1. Discover source schema/data through the source MCP/API.
2. Build `MigrationManifest v1.0`.
3. `idb_migration_plan` returns compatibility, warnings and blockers.
4. Provision/select an InvisibleDB instance.
5. `idb_migration_create` persists the manifest and compiled plan.
6. `idb_migration_start` queues a pre-migration destination backup.
7. `idb_migration_prepare` creates collections in two passes and resolves relations.
8. Stream data with `idb_migration_batch` (1-500 records, idempotent `batchKey`).
9. Stream auth identities with `idb_migration_auth_batch`.
10. Transfer storage with `idb_migration_file` using signed HTTPS source URLs; file bytes never pass through the LLM.
11. `idb_migration_verify` requires exact expected/imported row counts and zero failed batches.
12. `idb_migration_cutover` is blocked unless verification is `VERIFIED`.
13. `idb_migration_rollback` queues restore from the pre-migration backup filename.

## Migration Manifest v1.0

The source adapter must provide source provider/engine/capture time, tables, columns, primary keys, foreign keys, indexes, RLS policies and triggers. Optional sections cover auth, storage, functions, realtime and Postgres extensions.

The manifest is deliberately provider-neutral. Lovable Cloud is the first target, not a hard-coded dependency.

## Identity translation

PocketBase record IDs are generated deterministically from `(source table, source primary key)` using SHA-256 and truncated to a valid 15-character ID. Every migrated record also receives `_source_id`. Foreign keys use the same deterministic transform, so relations do not require a giant in-memory ID map.

## Postgres compatibility rules

- text/varchar/uuid -> text (UUID source identity preserved in `_source_id`)
- numeric families -> number
- boolean -> bool
- timestamp/date/time -> date
- json/jsonb/arrays -> json
- enums -> select
- foreign keys -> relation
- pgvector -> sqlite-vec (vector payload migration is separate)
- common owner RLS expressions using `auth.uid()` -> PocketBase request-auth rules
- complex subquery/JWT/EXISTS RLS -> blocker requiring review
- custom triggers/functions/extensions -> blocker unless explicitly recognized

## Auth

When portable password hashes are unavailable, the engine migrates identities/profile data but marks the migration as requiring password reset/OAuth re-link. It does not pretend password continuity exists.

## Storage safety

Remote file import requires HTTPS, rejects localhost/private-network literals, caps an object at 25 MB, and optionally verifies SHA-256 before upload.

## Evidence rule

No successful HTTP response is treated as proof of migration correctness. Cutover requires persisted verification evidence. Unknown/incomplete evidence blocks cutover.
