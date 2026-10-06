import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  UapiClient,
  SUPPORTED_UAPI_VERSION,
  assertCompatibleVersion,
  UapiError,
  VersionMismatchError,
} from '../src/index.js';
import { createMockFetch, explodingFetch, UAPI_ERROR, HTTP_FAIL } from './helpers.js';

const CFG = { host: 'server306.orangehost.com', user: 'momsoilc', apiToken: 'tok' };

describe('UAPI client', () => {
  it('pins the API version on every request and ledger entry', async () => {
    const mock = createMockFetch();
    const c = new UapiClient({ ...CFG, fetchImpl: mock.fetch });
    await c.addSubdomain('acme', 'example.com', 'public_html/acme');
    await c.createDatabase('acme_db');
    assert.equal(mock.calls.length, 2);
    for (const call of mock.calls) {
      assert.equal(call.headers['x-baas-cpanel-api-version'], SUPPORTED_UAPI_VERSION);
      assert.equal(call.headers['x-baas-cpanel-api-version'], '138');
    }
    for (const entry of c.getCallLog()) {
      assert.equal(entry.apiVersion, '138');
      assert.equal(entry.dryRun, false);
    }
  });

  it('posts to /execute/<Module>/<func> with token auth and form body', async () => {
    const mock = createMockFetch();
    const c = new UapiClient({ ...CFG, fetchImpl: mock.fetch });
    await c.addSubdomain('acme', 'example.com', 'public_html/acme');
    const [call] = mock.calls;
    assert.equal(call.kind, 'uapi');
    assert.equal(call.module, 'SubDomain');
    assert.equal(call.func, 'addsubdomain');
    assert.deepEqual(call.params, {
      domain: 'acme',
      rootdomain: 'example.com',
      dir: 'public_html/acme',
    });
    assert.equal(call.headers['authorization'], 'cpanel momsoilc:tok');
  });

  it('throws UapiError naming module/func when the envelope reports failure', async () => {
    const mock = createMockFetch({ 'UAPI:Mysql/create_database': UAPI_ERROR('database exists') });
    const c = new UapiClient({ ...CFG, fetchImpl: mock.fetch });
    await assert.rejects(() => c.createDatabase('x'), (e: unknown) => {
      assert.ok(e instanceof UapiError);
      assert.match(e.message, /Mysql::create_database/);
      assert.match(e.message, /database exists/);
      return true;
    });
  });

  it('throws UapiError with httpStatus on transport failure', async () => {
    const mock = createMockFetch({ 'UAPI:SSL/list_certs': HTTP_FAIL(500) });
    const c = new UapiClient({ ...CFG, fetchImpl: mock.fetch });
    await assert.rejects(() => c.listSslDomains(), (e: unknown) => {
      assert.ok(e instanceof UapiError);
      assert.equal((e as UapiError).httpStatus, 500);
      return true;
    });
  });

  it('provisions a database as create_database → create_user → set_privileges', async () => {
    const mock = createMockFetch();
    const c = new UapiClient({ ...CFG, fetchImpl: mock.fetch });
    const out = await c.provisionDatabase('acme_db', 'acme_u', 's3cret');
    assert.deepEqual(out, { db: 'momsoilc_acme_db', user: 'momsoilc_acme_u' });
    assert.deepEqual(mock.callKeys(), [
      'UAPI:Mysql/create_database',
      'UAPI:Mysql/create_user',
      'UAPI:Mysql/set_privileges_on_database',
    ]);
    // secrets travel on the wire but are scrubbed from the ledger
    assert.equal(mock.calls[1].params['password'], 's3cret');
    assert.equal(c.getCallLog()[1].params['password'], '***');
  });

  it('removes cron lines by matching command → resolving line number → delete', async () => {
    const mock = createMockFetch({
      'UAPI:Cron/list_lines': [
        { line: 3, command: '/usr/bin/other.sh' },
        { line: 7, command: '$HOME/apps/acme/watchdog.sh >> log 2>&1' },
      ],
    });
    const c = new UapiClient({ ...CFG, fetchImpl: mock.fetch });
    const removed = await c.removeCronLinesMatching('apps/acme/watchdog.sh');
    assert.equal(removed, 1);
    assert.deepEqual(mock.callKeys(), ['UAPI:Cron/list_lines', 'UAPI:Cron/delete_line']);
    assert.equal(mock.calls[1].params['line'], '7');
  });

  it('dry-run issues zero network calls but records the plan', async () => {
    const c = new UapiClient({ ...CFG, fetchImpl: explodingFetch(), dryRun: true });
    await c.addSubdomain('acme', 'example.com', 'public_html/acme');
    await c.provisionDatabase('acme_db', 'acme_u', 's3cret');
    await c.waitForAutoSsl('acme.example.com'); // returns immediately, no polling
    const log = c.getCallLog();
    assert.ok(log.length >= 5);
    assert.ok(log.every((e) => e.dryRun && e.apiVersion === '138'));
    assert.deepEqual(
      log.map((e) => `${e.module}/${e.func}`),
      [
        'SubDomain/addsubdomain',
        'Mysql/create_database',
        'Mysql/create_user',
        'Mysql/set_privileges_on_database',
        'SSL/waitForAutoSsl(poll list_certs)',
      ],
    );
  });

  it('verifyServerVersion refuses drift when a probe is configured', async () => {
    const newer = new UapiClient({
      ...CFG,
      fetchImpl: explodingFetch(),
      versionProbe: async () => '11.140.0.3',
    });
    await assert.rejects(() => newer.verifyServerVersion(), VersionMismatchError);

    const same = new UapiClient({
      ...CFG,
      fetchImpl: explodingFetch(),
      versionProbe: async () => '11.138.0.11',
    });
    await same.verifyServerVersion(); // no throw

    const older = new UapiClient({
      ...CFG,
      fetchImpl: explodingFetch(),
      versionProbe: async () => '11.120.0.7',
    });
    await older.verifyServerVersion(); // pin is a ceiling, not a floor

    const noProbe = new UapiClient({ ...CFG, fetchImpl: explodingFetch() });
    await noProbe.verifyServerVersion(); // no-op without a probe
  });
});

describe('assertCompatibleVersion', () => {
  it('accepts the pinned and older majors', () => {
    assertCompatibleVersion('11.138.0.11', '138');
    assertCompatibleVersion('11.120.0.7', '138');
  });
  it('rejects newer majors', () => {
    assert.throws(() => assertCompatibleVersion('11.139.0.1', '138'), VersionMismatchError);
    assert.throws(() => assertCompatibleVersion('12.140.0.1', '138'), VersionMismatchError);
  });
  it('rejects unparseable versions instead of guessing', () => {
    assert.throws(() => assertCompatibleVersion('banana', '138'), VersionMismatchError);
  });
});
