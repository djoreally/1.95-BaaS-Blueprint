import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGateSet, softwareReleaseGates, contextGate, gatePassed, orderTaskGraph } from '../src/index.js';

describe('ZeroGate', () => {
  it('passes when every gate has VERIFIED evidence', async () => {
    const gates = softwareReleaseGates();
    const ctx: Record<string, unknown> = {};
    for (const g of gates) ctx[g.id] = 'VERIFIED';

    const result = await evaluateGateSet(gates, ctx);
    assert.equal(result.passed, true);
    assert.equal(result.blockedAt, undefined);
    assert.equal(result.results.length, gates.length);
    assert.ok(result.results.every((r) => r.passed));
  });

  it('blocks at the first failing gate and skips later gates', async () => {
    const gates = softwareReleaseGates();
    const evaluated: string[] = [];
    const wrapped = gates.map((g) => ({
      ...g,
      evaluate: (ctx: Record<string, unknown>) => {
        evaluated.push(g.id);
        return g.evaluate(ctx);
      },
    }));
    const ctx: Record<string, unknown> = {
      'code-complete': 'VERIFIED',
      'typecheck': 'VERIFIED',
      'unit-tests': 'FAILED',
      'integration-tests': 'VERIFIED', // must NOT be evaluated
    };

    const result = await evaluateGateSet(wrapped, ctx);
    assert.equal(result.passed, false);
    assert.equal(result.blockedAt, 'unit-tests');
    assert.deepEqual(evaluated, ['code-complete', 'typecheck', 'unit-tests']);
  });

  it('missing evidence is UNKNOWN and blocks (fail-closed)', async () => {
    const gates = [contextGate('deploy', 'Deploy authorized')];
    const result = await evaluateGateSet(gates, {});
    assert.equal(result.passed, false);
    assert.equal(result.blockedAt, 'deploy');
    assert.equal(result.results[0].evidence, 'UNKNOWN');
  });

  it('PARTIAL evidence blocks — only VERIFIED passes', () => {
    assert.equal(gatePassed('VERIFIED'), true);
    assert.equal(gatePassed('PARTIAL'), false);
    assert.equal(gatePassed('UNKNOWN'), false);
    assert.equal(gatePassed('FAILED'), false);
  });

  it('accepts { state } objects as evidence', async () => {
    const gates = [contextGate('security', 'Security review')];
    const ok = await evaluateGateSet(gates, { security: { state: 'VERIFIED', reviewedBy: 'sec-agent' } });
    assert.equal(ok.passed, true);
  });
});

describe('orderTaskGraph', () => {
  it('orders nodes after their dependencies', () => {
    const ordered = orderTaskGraph({
      nodes: [
        { id: 'test', dependencies: ['build'], owner: 'qa', inputs: {}, expectedOutputs: [], timeout: 1000, retryPolicy: { maxAttempts: 1, backoffMs: 0, maxBackoffMs: 0 }, permissions: [] },
        { id: 'build', dependencies: [], owner: 'backend', inputs: {}, expectedOutputs: [], timeout: 1000, retryPolicy: { maxAttempts: 1, backoffMs: 0, maxBackoffMs: 0 }, permissions: [] },
      ],
    });
    assert.deepEqual(ordered.map((n) => n.id), ['build', 'test']);
  });

  it('throws on cycles and unknown dependencies', () => {
    const mk = (id: string, dependencies: string[]) => ({
      id, dependencies, owner: 'x', inputs: {}, expectedOutputs: [], timeout: 1,
      retryPolicy: { maxAttempts: 1, backoffMs: 0, maxBackoffMs: 0 }, permissions: [],
    });
    assert.throws(() => orderTaskGraph({ nodes: [mk('a', ['b']), mk('b', ['a'])] }), /cycle/);
    assert.throws(() => orderTaskGraph({ nodes: [mk('a', ['ghost'])] }), /unknown node/);
  });
});
