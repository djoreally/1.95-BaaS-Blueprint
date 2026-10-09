# @baas-195/mcp-server

InvisibleDB MCP server for Claude Code, Claude Desktop, ChatGPT-compatible MCP clients, and custom agents. The control plane now exposes a real bearer-key API; the MCP is not a stub-only surface.

## Core tools

`idb_provision`, `idb_list`, `idb_keys`, `idb_query`, `idb_gate_check`, `idb_status`.

## Migration tools

- `idb_migration_manifest_spec` — neutral manifest shape + read-only Lovable/Supabase/Postgres discovery SQL
- `idb_migration_plan` — compile compatibility plan without mutation
- `idb_migration_create` — persist reviewed plan/manifest
- `idb_migration_start` — queue destination snapshot
- `idb_migration_prepare` — create collections/relations after snapshot
- `idb_migration_batch` — idempotent 1-500 row ETL batches
- `idb_migration_auth_batch` — auth identity migration with honest password-reset semantics
- `idb_migration_file` — server-to-server signed-URL storage transfer
- `idb_migration_verify` — exact count/failed-batch/blocker evidence
- `idb_migration_cutover` — blocked unless evidence is VERIFIED
- `idb_migration_rollback` — restore pre-migration backup
- `idb_migration_status` — inspect resumable job/batch state

The intended Lovable flow is: connect the Lovable MCP and InvisibleDB MCP to the same agent; call `idb_migration_manifest_spec`; let the agent run the returned read-only SQL on Lovable; build the manifest; plan; then execute the staged migration. The LLM never moves large file bytes and never receives database owner credentials.

## Setup

Create a control-plane API key from InvisibleDB account settings/API keys. The token is shown once.

```bash
npm install
npm run build
```

Environment:

- `INVISIBLED_API_URL=https://www.invisibledb.app`
- `INVISIBLED_API_KEY=idb_sk_...`

Claude Code `.mcp.json`:

```json
{
  "mcpServers": {
    "invisibledb": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "INVISIBLED_API_URL": "https://www.invisibledb.app",
        "INVISIBLED_API_KEY": "<your idb_sk key>"
      }
    }
  }
}
```

## Evidence rule

Provisioning is not READY until status says ready. Migration is not safe to cut over until verification says `VERIFIED`. `PARTIAL`, `FAILED`, and `UNKNOWN` block cutover.
