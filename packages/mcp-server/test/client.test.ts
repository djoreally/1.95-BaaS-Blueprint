import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RestInvisibleDBClient,
  NoTransportError,
  fakeTransport,
  stubTransport,
} from '../src/client.js';

describe('RestInvisibleDBClient with stub transport', () => {
  it('fails loudly with NoTransportError when unconfigured', async () => {
    const client = new RestInvisibleDBClient(stubTransport());
    await assert.rejects(() => client.list(), NoTransportError);
    await assert.rejects(() => client.status(), NoTransportError);
  });
});

describe('RestInvisibleDBClient with fake transport', () => {
  const keys = {
    inst_1: {
      instanceId: 'inst_1',
      baseUrl: 'https://demo.invisibledb.io',
      adminUrl: 'https://demo.invisibledb.io/_/',
      publishableKey: 'pk_test_fake',
      secretKey: 'sk_test_fake',
      dartSnippet: 'final pb = PocketBase("https://demo.invisibledb.io");',
      restSnippet: 'curl https://demo.invisibledb.io/api/health',
    },
  };
  const make = () => new RestInvisibleDBClient(fakeTransport({ keys }));

  it('status reports ok with instance count', async () => {
    const s = await make().status();
    assert.equal(s.ok, true);
    assert.equal(typeof s.version, 'string');
  });

  it('provision then list returns the new instance', async () => {
    const client = make();
    const inst = await client.provision({ name: 'acme-crm' });
    assert.equal(inst.name, 'acme-crm');
    assert.equal(inst.status, 'ready');
    assert.match(inst.fqdn, /acme-crm\./);
    const list = await client.list();
    assert.ok(list.some((i) => i.id === inst.id));
  });

  it('provision defaults plan to seat and accepts dev', async () => {
    const client = make();
    const a = await client.provision({ name: 'paid' });
    const b = await client.provision({ name: 'free', plan: 'dev' });
    assert.equal(a.plan, 'seat');
    assert.equal(b.plan, 'dev');
  });

  it('keys returns the stored key bundle', async () => {
    const k = await make().keys('inst_1');
    assert.equal(k.publishableKey, 'pk_test_fake');
    assert.ok(k.dartSnippet.includes('PocketBase'));
  });

  it('keys throws for unknown instance', async () => {
    await assert.rejects(() => make().keys('nope'), /no route/);
  });

  it('query returns a shaped empty result', async () => {
    const r = await make().query('inst_1', 'notes', 'done = true', { perPage: 10 });
    assert.equal(r.instanceId, 'inst_1');
    assert.equal(r.collection, 'notes');
    assert.deepEqual(r.items, []);
    assert.equal(r.perPage, 10);
  });

  it('gateCheck is honestly UNKNOWN with no evidence (evidence rule)', async () => {
    const r = await make().gateCheck('inst_1', 'unit-tests');
    assert.equal(r.state, 'UNKNOWN');
    assert.deepEqual(r.evidence, []);
  });
});
