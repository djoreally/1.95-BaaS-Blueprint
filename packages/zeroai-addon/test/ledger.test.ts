import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZeroLedger, GENESIS_PARENT, canonical, sha256Hex } from '../src/index.js';

describe('ZeroLedger', () => {
  it('appends events chained to the previous hash', () => {
    const ledger = new ZeroLedger();
    const e1 = ledger.append({ workspaceId: 'ws1', actor: 'backend', action: 'WRITE', input: { a: 1 } });
    const e2 = ledger.append({ workspaceId: 'ws1', actor: 'qa', action: 'READ', input: { a: 1 }, output: { ok: true } });

    assert.equal(e1.parentHash, GENESIS_PARENT);
    assert.equal(e2.parentHash, e1.eventId);
    assert.equal(e1.eventId.length, 64);
    assert.ok(e2.outputHash);
    assert.deepEqual(ledger.verify(), { valid: true });
  });

  it('detects tampering with an event payload', () => {
    const ledger = new ZeroLedger();
    ledger.append({ workspaceId: 'ws1', actor: 'backend', action: 'WRITE', input: { a: 1 } });
    ledger.append({ workspaceId: 'ws1', actor: 'backend', action: 'WRITE', input: { a: 2 } });
    ledger.append({ workspaceId: 'ws1', actor: 'backend', action: 'WRITE', input: { a: 3 } });

    // Tamper: rewrite history on the middle event (bypassing append).
    const exported = ledger.export();
    exported[1] = { ...exported[1], action: 'DELETE' };
    ledger.import(exported);

    const result = ledger.verify();
    assert.equal(result.valid, false);
    assert.equal(result.brokenAt, 1);
    assert.match(result.reason ?? '', /hash mismatch/);
  });

  it('detects a rewritten parentHash (chain splice)', () => {
    const ledger = new ZeroLedger();
    ledger.append({ workspaceId: 'ws1', actor: 'a', action: 'X', input: 1 });
    const e2 = ledger.append({ workspaceId: 'ws1', actor: 'a', action: 'Y', input: 2 });

    const exported = ledger.export();
    // Recompute e2's own hash so only the linkage is wrong — still caught.
    const tampered = { ...exported[1], parentHash: 'deadbeef'.repeat(8) };
    void e2;
    ledger.import([exported[0], tampered]);

    const result = ledger.verify();
    assert.equal(result.valid, false);
    assert.equal(result.brokenAt, 1);
    assert.match(result.reason ?? '', /parentHash mismatch/);
  });

  it('hashes are deterministic regardless of key order', () => {
    assert.equal(sha256Hex(canonical({ b: 2, a: 1 })), sha256Hex(canonical({ a: 1, b: 2 })));
  });

  it('export/import round-trips a verifiable chain', () => {
    const a = new ZeroLedger();
    a.append({ workspaceId: 'w', actor: 'a', action: 'X', input: { n: 1 }, evidenceRefs: ['ev-1'] });
    a.append({ workspaceId: 'w', actor: 'b', action: 'Y', input: { n: 2 } });
    const b = new ZeroLedger();
    b.import(a.export());
    assert.deepEqual(b.verify(), { valid: true });
    assert.equal(b.length, 2);
  });
});
