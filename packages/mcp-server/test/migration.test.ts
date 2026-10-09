import assert from 'node:assert/strict';
import test from 'node:test';
import { RestInvisibleDBClient, fakeTransport } from '../src/client.js';
import { POSTGRES_DISCOVERY } from '../src/migration-discovery.js';
import { tools } from '../src/tools.js';

test('migration tools are registered', () => {
  const names = new Set(tools.map((tool) => tool.name));
  for (const name of ['idb_migration_manifest_spec','idb_migration_plan','idb_migration_create','idb_migration_start','idb_migration_prepare','idb_migration_batch','idb_migration_auth_batch','idb_migration_file','idb_migration_resolve','idb_migration_verify','idb_migration_cutover','idb_migration_rollback','idb_migration_status']) {
    assert.equal(names.has(name), true, name);
  }
});

test('discovery explicitly separates estimates from exact counts', () => {
  assert.match(POSTGRES_DISCOVERY.sql.relation_inventory, /estimated_rows/);
  assert.match(POSTGRES_DISCOVERY.sql.exact_count_statements, /count\(\*\)/i);
  assert.match(POSTGRES_DISCOVERY.instructions.join(' '), /Never copy an estimate/i);
});

test('fake client preserves migration state transitions', async () => {
  const client = new RestInvisibleDBClient(fakeTransport());
  const created = await client.migration('demo', 'create', { manifest: { source: { provider: 'lovable-cloud' } } }) as Record<string, unknown>;
  assert.equal(created.status, 'planned');
  const id = String(created.id);
  const prepared = await client.migration('demo', 'prepare', { migrationId: id }) as Record<string, unknown>;
  assert.equal(prepared.status, 'schema_ready');
  const verified = await client.migration('demo', 'verify', { migrationId: id }) as Record<string, unknown>;
  assert.equal(verified.status, 'verified');
  const status = await client.migrationStatus('demo', id) as Record<string, unknown>;
  assert.equal(status.id, id);
});
