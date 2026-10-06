import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProject, deleteProject, ProvisionError, VersionMismatchError } from '../src/index.js';
import { createMockFetch, explodingFetch, UAPI_ERROR } from './helpers.js';

const CFG = { host: 'server306.orangehost.com', user: 'momsoilc', apiToken: 'tok' };
const INPUT = { name: 'acme', domain: 'example.com', port: 8091, dbPassword: 's3cret' };

describe('createProject', () => {
  it('happy path runs steps in dependency order and returns the provisioned record', async () => {
    const mock = createMockFetch({
      'UAPI:SSL/list_certs': [{ domain: 'acme.example.com' }],
    });
    const out = await createProject({ ...CFG, fetchImpl: mock.fetch }, INPUT);
    assert.deepEqual(mock.callKeys(), [
      'UAPI:SubDomain/addsubdomain',
      'UAPI:Mysql/create_database',
      'UAPI:Mysql/create_user',
      'UAPI:Mysql/set_privileges_on_database',
      'UAPI:SSL/list_certs',
      'UAPI:Cron/add_line',
    ]);
    assert.equal(out.name, 'acme');
    assert.equal(out.fqdn, 'acme.example.com');
    assert.equal(out.port, 8091);
    assert.deepEqual(out.db, { name: 'momsoilc_acme_db', user: 'momsoilc_acme_u' });
    assert.equal(out.docRoot, 'public_html/acme');
    assert.equal(out.sslPending, false);
    assert.equal(out.dryRun, false);
    // the watchdog cron line targets this project's supervisor dir
    assert.match(mock.calls[5].params['command'], /apps\/acme\/watchdog\.sh/);
  });

  it('rolls back in reverse order when a mid-sequence step fails', async () => {
    const mock = createMockFetch({
      'UAPI:Mysql/create_user': UAPI_ERROR('user quota exceeded'),
    });
    await assert.rejects(() => createProject({ ...CFG, fetchImpl: mock.fetch }, INPUT), (e: unknown) => {
      assert.ok(e instanceof ProvisionError);
      assert.equal(e.step, 'db-user');
      assert.match(e.message, /user quota exceeded/);
      assert.deepEqual(e.rollback, []); // compensating calls all succeeded
      return true;
    });
    // compensating teardown ran newest-first: db, then subdomain (cron/ssl never ran)
    assert.deepEqual(mock.callKeys(), [
      'UAPI:SubDomain/addsubdomain',
      'UAPI:Mysql/create_database',
      'UAPI:Mysql/create_user',
      'UAPI:Mysql/delete_database',
      'UAPI:SubDomain/delsubdomain',
    ]);
  });

  it('reports rollback failures instead of swallowing them', async () => {
    const mock = createMockFetch({
      'UAPI:Mysql/create_user': UAPI_ERROR('boom'),
      'UAPI:Mysql/delete_database': UAPI_ERROR('locked'),
    });
    await assert.rejects(() => createProject({ ...CFG, fetchImpl: mock.fetch }, INPUT), (e: unknown) => {
      assert.ok(e instanceof ProvisionError);
      assert.equal(e.rollback.length, 1);
      assert.equal(e.rollback[0].step, 'database');
      assert.match(e.rollback[0].error, /locked/);
      return true;
    });
  });

  it('refuses before step 1 when the version probe reports drift', async () => {
    const mock = createMockFetch();
    await assert.rejects(
      () =>
        createProject(
          { ...CFG, fetchImpl: mock.fetch, versionProbe: async () => '11.140.0.1' },
          INPUT,
        ),
      (e: unknown) => {
        assert.ok(e instanceof ProvisionError);
        assert.equal(e.step, 'version-check');
        assert.ok(e.cause instanceof VersionMismatchError);
        return true;
      },
    );
    assert.equal(mock.calls.length, 0); // nothing touched the server
  });

  it('dry-run makes zero network calls and returns the plan', async () => {
    const out = await createProject({ ...CFG, fetchImpl: explodingFetch() }, { ...INPUT, dryRun: true });
    assert.equal(out.dryRun, true);
    assert.equal(out.sslPending, false);
    const plan = out.callLog.map((c) => `${c.module}/${c.func}`);
    assert.deepEqual(plan, [
      'SubDomain/addsubdomain',
      'Mysql/create_database',
      'Mysql/create_user',
      'Mysql/set_privileges_on_database',
      'SSL/waitForAutoSsl(poll list_certs)',
      'Cron/add_line',
    ]);
    assert.ok(out.callLog.every((c) => c.apiVersion === '138' && c.dryRun));
  });

  it('an SSL timeout warns (sslPending) instead of rolling back by default', async () => {
    const mock = createMockFetch({ 'UAPI:SSL/list_certs': [] }); // cert never appears
    const out = await createProject(
      { ...CFG, fetchImpl: mock.fetch },
      { ...INPUT, sslTimeoutMs: 50 },
    );
    assert.equal(out.sslPending, true);
    // provisioning continued: the cron step still ran
    assert.ok(mock.callKeys().includes('UAPI:Cron/add_line'));
  });

  it('rejects invalid project names before any network call', async () => {
    const mock = createMockFetch();
    await assert.rejects(
      () => createProject({ ...CFG, fetchImpl: mock.fetch }, { ...INPUT, name: 'Bad Name!' }),
      /invalid project name/,
    );
    assert.equal(mock.calls.length, 0);
  });
});

describe('deleteProject', () => {
  it('tears down in reverse order: cron → db-user → database → subdomain', async () => {
    const mock = createMockFetch({
      'UAPI:Cron/list_lines': [{ line: 7, command: '$HOME/apps/acme/watchdog.sh >> log 2>&1' }],
    });
    const report = await deleteProject({ ...CFG, fetchImpl: mock.fetch }, { name: 'acme', domain: 'example.com' });
    assert.deepEqual(mock.callKeys(), [
      'UAPI:Cron/list_lines',
      'UAPI:Cron/delete_line',
      'UAPI:Mysql/delete_user',
      'UAPI:Mysql/delete_database',
      'UAPI:SubDomain/delsubdomain',
    ]);
    assert.deepEqual(report.removed, ['cron', 'db-user', 'database', 'subdomain']);
    assert.deepEqual(report.errors, []);
    assert.equal(mock.calls[2].params['name'], 'momsoilc_acme_u');
    assert.equal(mock.calls[3].params['name'], 'momsoilc_acme_db');
  });

  it('is best-effort: one stuck resource does not block the rest', async () => {
    const mock = createMockFetch({
      'UAPI:Cron/list_lines': [],
      'UAPI:Mysql/delete_user': UAPI_ERROR('in use'),
    });
    const report = await deleteProject({ ...CFG, fetchImpl: mock.fetch }, { name: 'acme', domain: 'example.com' });
    assert.deepEqual(report.removed, ['cron', 'database', 'subdomain']);
    assert.equal(report.errors.length, 1);
    assert.equal(report.errors[0].step, 'db-user');
  });
});
