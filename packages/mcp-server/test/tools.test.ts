import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RestInvisibleDBClient,
  fakeTransport,
  type InvisibleDBClient,
} from '../src/client.js';
import {
  handleGateCheck,
  handleList,
  handleProvision,
  handleQuery,
  tools,
} from '../src/tools.js';

function textOf(result: { content: Array<{ type: 'text'; text: string }> }): unknown {
  return JSON.parse(result.content[0]!.text);
}

describe('tool registry', () => {
  it('exposes exactly the six documented tools', () => {
    assert.deepEqual(
      tools.map((t) => t.name),
      ['idb_provision', 'idb_list', 'idb_keys', 'idb_query', 'idb_gate_check', 'idb_status'],
    );
  });
});

describe('handlers', () => {
  const client: InvisibleDBClient = new RestInvisibleDBClient(fakeTransport());

  it('handleProvision warns while provisioning is not ready', async () => {
    const out = textOf(await handleProvision(client, { name: 'x' })) as {
      status: string;
      note?: string;
    };
    // Fake provisions straight to ready; the note path is for the real API.
    assert.equal(out.status, 'ready');
    assert.equal(out.note, undefined);
  });

  it('handleList reports count', async () => {
    await client.provision({ name: 'a' });
    const out = textOf(await handleList(client)) as { count: number; instances: unknown[] };
    assert.equal(out.count, out.instances.length);
    assert.ok(out.count >= 1);
  });

  it('handleQuery passes collection and filter through', async () => {
    const out = textOf(
      await handleQuery(client, { instance: 'i', collection: 'tasks', filter: 'done = false' }),
    ) as { collection: string; instanceId: string };
    assert.equal(out.collection, 'tasks');
    assert.equal(out.instanceId, 'i');
  });

  it('handleGateCheck interprets unknown as not-passed', async () => {
    const out = textOf(
      await handleGateCheck(client, { instance: 'i', gate: 'security' }),
    ) as { state: string; interpretation: string };
    assert.equal(out.state, 'UNKNOWN');
    assert.match(out.interpretation, /not-passed/);
  });
});
