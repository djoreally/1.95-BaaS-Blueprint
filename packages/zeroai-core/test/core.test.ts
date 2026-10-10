import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ZeroCert,
  ZeroDeploymentMachine,
  ZeroLedger,
  ZeroMemory,
  evaluateGates,
  evaluatePolicy,
  runZeroTests,
  type ZeroAction,
  type ZeroActor,
} from '../src/index.js';

test('sensitive external effects require approval by default', () => {
  const actor: ZeroActor = {
    id: 'agent:billing',
    type: 'agent',
    projectId: 'project-1',
    capabilities: ['stripe.refunds.create'],
  };
  const action: ZeroAction = {
    id: 'action-1',
    capability: 'stripe.refunds.create',
    resource: 'payment:1',
    effect: 'external_effect',
    risk: 'high',
  };

  assert.equal(evaluatePolicy(actor, action, []).decision, 'require_approval');
});

test('missing capability denies before any permissive rule can apply', () => {
  const actor: ZeroActor = {
    id: 'agent:viewer',
    type: 'agent',
    projectId: 'project-1',
    capabilities: [],
  };
  const action: ZeroAction = {
    id: 'action-2',
    capability: 'customers.delete',
    resource: 'customer:1',
    effect: 'irreversible_write',
    risk: 'critical',
  };

  const result = evaluatePolicy(actor, action, [
    { id: 'allow-delete', capability: 'customers.delete', decision: 'allow' },
  ]);
  assert.equal(result.decision, 'deny');
});

test('ZeroTest fails closed when a required test plane is missing', async () => {
  const run = await runZeroTests('logic', [
    {
      id: 'white:typecheck',
      plane: 'white',
      description: 'typecheck',
      run: () => ({ id: 'white:typecheck', plane: 'white', status: 'pass', required: true, summary: 'ok' }),
    },
  ]);

  assert.equal(run.passed, false);
  assert.ok(run.results.some((result) => result.id === 'missing:grey' && result.status === 'fail'));
  assert.ok(run.results.some((result) => result.id === 'missing:black' && result.status === 'fail'));
  assert.equal(evaluateGates(run.results).approved, false);
});

test('ZeroCert treats missing evidence as UNKNOWN and never self-certifies', () => {
  const cert = new ZeroCert();
  const record = cert.certify('migration-safety');
  assert.equal(record.state, 'UNKNOWN');
  assert.equal(cert.allVerified(), false);
});

test('ZeroLedger chains and verifies deterministic event hashes', () => {
  const ledger = new ZeroLedger();
  ledger.append({
    projectId: 'project-1',
    actor: 'agent:test',
    action: 'schema.propose',
    input: { version: 1 },
    timestamp: '2026-10-10T00:00:00.000Z',
  });
  ledger.append({
    projectId: 'project-1',
    actor: 'system:zerogate',
    action: 'deployment.approve',
    input: { candidate: 'green' },
    output: { approved: true },
    timestamp: '2026-10-10T00:00:01.000Z',
  });

  assert.equal(ledger.length, 2);
  assert.deepEqual(ledger.verify(), { valid: true });
  assert.equal(ledger.list()[1].parentHash, ledger.list()[0].eventId);
});

test('ZeroMemory compaction never exceeds the requested byte budget', async () => {
  const memory = new ZeroMemory();
  await memory.remember('alpha'.repeat(40), 'facts', { salience: 0.9 });
  await memory.remember('beta'.repeat(40), 'facts', { salience: 0.4 });
  await memory.remember('gamma'.repeat(40), 'facts', { salience: 0.2 });

  const report = await memory.compact(450);
  const active = await memory.activeMemory(450);
  assert.ok(report.bytesAfter <= 450);
  assert.ok(Buffer.byteLength(active, 'utf8') <= 450);
});

test('schema-changing promotion requires approved gates and writer fence', () => {
  const deploy = new ZeroDeploymentMachine({
    id: 'deploy-1',
    projectId: 'project-1',
    active: 'blue',
    candidate: 'green',
    changeClass: 'schema',
    sourceSchemaVersion: 'schema-1',
    targetSchemaVersion: 'schema-2',
    writerFenceRequired: true,
  });

  deploy.candidateReady();
  deploy.beginTesting();
  deploy.applyGateDecision({ approved: true, blocking: [] });
  assert.throws(() => deploy.promote(), /writer fence synchronization/);

  deploy.satisfyWriterFence();
  const promoted = deploy.promote('2026-10-10T00:00:02.000Z');
  assert.equal(promoted.state, 'promoted');
  assert.equal(promoted.active, 'green');
  assert.equal(promoted.candidate, 'blue');
});
