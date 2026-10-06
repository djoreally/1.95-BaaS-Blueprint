import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WhmClient, WhmError } from '../src/index.js';
import { createMockFetch, WHM_ERROR, HTTP_FAIL } from './helpers.js';

const CFG = { host: 'server306.orangehost.com', apiToken: 'whm-tok' };

describe('WHM client', () => {
  it('stamps api.version=1 and uses whm <user>:<token> auth', async () => {
    const mock = createMockFetch();
    const c = new WhmClient({ ...CFG, fetchImpl: mock.fetch });
    await c.getVersion();
    const [call] = mock.calls;
    assert.equal(call.kind, 'whm');
    assert.equal(call.func, 'version');
    assert.equal(call.headers['authorization'], 'whm root:whm-tok'); // default user is root
  });

  it('honors a non-root reseller user in the auth header', async () => {
    const mock = createMockFetch();
    const c = new WhmClient({ ...CFG, user: 'reseller1', fetchImpl: mock.fetch });
    await c.getVersion();
    assert.equal(mock.calls[0].headers['authorization'], 'whm reseller1:whm-tok');
  });

  it('getVersion returns the server version string', async () => {
    const mock = createMockFetch({ 'WHM:version': { version: '11.138.0.11' } });
    const c = new WhmClient({ ...CFG, fetchImpl: mock.fetch });
    assert.equal(await c.getVersion(), '11.138.0.11');
  });

  it('throws WhmError naming the function when result is 0', async () => {
    const mock = createMockFetch({ 'WHM:createacct': WHM_ERROR('username taken') });
    const c = new WhmClient({ ...CFG, fetchImpl: mock.fetch });
    await assert.rejects(
      () => c.createAccount({ username: 't1', domain: 't1.example.com', password: 'x', pkg: 'baas_tenant' }),
      (e: unknown) => {
        assert.ok(e instanceof WhmError);
        assert.match(e.message, /createacct/);
        assert.match(e.message, /username taken/);
        return true;
      },
    );
  });

  it('throws WhmError with httpStatus on transport failure', async () => {
    const mock = createMockFetch({ 'WHM:listaccts': HTTP_FAIL(403) });
    const c = new WhmClient({ ...CFG, fetchImpl: mock.fetch });
    await assert.rejects(() => c.listAccounts(), (e: unknown) => {
      assert.ok(e instanceof WhmError);
      assert.equal((e as WhmError).httpStatus, 403);
      return true;
    });
  });

  it('createAccount maps tenant fields to createacct params', async () => {
    const mock = createMockFetch();
    const c = new WhmClient({ ...CFG, fetchImpl: mock.fetch });
    await c.createAccount({ username: 'tenant1', domain: 't1.example.com', password: 'pw', pkg: 'baas_tenant' });
    assert.deepEqual(mock.calls[0].params, {
      username: 'tenant1',
      domain: 't1.example.com',
      password: 'pw',
      pkg: 'baas_tenant',
    });
  });

  it('suspend/unsuspend/remove map to their WHM functions', async () => {
    const mock = createMockFetch();
    const c = new WhmClient({ ...CFG, fetchImpl: mock.fetch });
    await c.suspendAccount('tenant1');
    await c.unsuspendAccount('tenant1');
    await c.removeAccount('tenant1');
    assert.deepEqual(mock.callKeys(), ['WHM:suspendacct', 'WHM:unsuspendacct', 'WHM:removeacct']);
    assert.equal(mock.calls[0].params['reason'], 'billing');
    assert.equal(mock.calls[2].params['keepdns'], '0');
  });

  it('listAccounts returns the acct array', async () => {
    const mock = createMockFetch({
      'WHM:listaccts': { acct: [{ user: 'tenant1', domain: 't1.example.com' }] },
    });
    const c = new WhmClient({ ...CFG, fetchImpl: mock.fetch });
    const accts = await c.listAccounts();
    assert.equal(accts.length, 1);
    assert.equal(accts[0].user, 'tenant1');
  });
});
