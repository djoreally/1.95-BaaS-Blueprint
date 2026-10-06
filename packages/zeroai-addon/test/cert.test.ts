import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZeroCert } from '../src/index.js';

describe('ZeroCert', () => {
  it('no evidence means UNKNOWN, never success', () => {
    const cert = new ZeroCert();
    assert.equal(cert.certify('customer deletion works').state, 'UNKNOWN');
    assert.equal(cert.certify('customer deletion works', {}).state, 'UNKNOWN');
  });

  it('maps evidence to states deterministically', () => {
    const cert = new ZeroCert();
    assert.equal(cert.certify('a', { passed: true, tests: '842/842' }).state, 'VERIFIED');
    assert.equal(cert.certify('b', { passed: false }).state, 'FAILED');
    assert.equal(cert.certify('c', { partial: true }).state, 'PARTIAL');
    assert.equal(cert.certify('d', { state: 'VERIFIED' }).state, 'VERIFIED');
    assert.equal(cert.certify('e', { note: 'no outcome recorded' }).state, 'UNKNOWN');
  });

  it('explicit state wins over flags', () => {
    const cert = new ZeroCert();
    assert.equal(cert.certify('a', { state: 'PARTIAL', passed: true }).state, 'PARTIAL');
  });

  it('summary counts and allVerified gate the release', () => {
    const cert = new ZeroCert();
    assert.equal(cert.allVerified(), false); // empty is not verified
    cert.certify('unit tests', { passed: true });
    cert.certify('e2e', { passed: true });
    assert.deepEqual(cert.summary(), { VERIFIED: 2, PARTIAL: 0, UNKNOWN: 0, FAILED: 0 });
    assert.equal(cert.allVerified(), true);
    cert.certify('security review', { passed: false });
    assert.equal(cert.allVerified(), false);
  });
});
