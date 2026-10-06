import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZeroPolicy, PolicyDeniedError, defaultPolicyRules } from '../src/index.js';

describe('ZeroPolicy', () => {
  it('most-specific rule wins over wildcards', () => {
    const p = new ZeroPolicy();
    p.addRule({ agent: '*', action: '*', environment: '*', decision: 'deny' });
    p.addRule({ agent: 'backend', action: 'MODIFY_DATABASE', environment: 'production', decision: 'approval-required' });

    assert.equal(p.decide({ agent: 'backend', action: 'MODIFY_DATABASE', environment: 'production' }), 'approval-required');
    assert.equal(p.decide({ agent: 'backend', action: 'READ', environment: 'production' }), 'deny');
  });

  it('is fail-closed: no matching rule denies', () => {
    const p = new ZeroPolicy();
    assert.equal(p.decide({ agent: 'qa', action: 'DEPLOY', environment: 'staging' }), 'deny');
  });

  it('check() throws PolicyDeniedError on deny', () => {
    const p = new ZeroPolicy();
    p.addRule({ agent: '*', action: '*', environment: '*', decision: 'deny' });
    assert.throws(
      () => p.check({ agent: 'ops', action: 'DELETE', environment: 'production' }),
      (e) => e instanceof PolicyDeniedError,
    );
  });

  it('check() returns approval-required without throwing', () => {
    const p = new ZeroPolicy();
    p.addRule({ agent: '*', action: 'CHARGE_CARD', environment: '*', decision: 'approval-required' });
    assert.equal(p.check({ agent: 'billing', action: 'CHARGE_CARD', environment: 'production' }), 'approval-required');
  });

  it('check() returns true when allowed', () => {
    const p = new ZeroPolicy();
    p.addRule({ agent: '*', action: 'READ', environment: '*', decision: 'allow' });
    assert.equal(p.check({ agent: 'research', action: 'READ', environment: 'production' }), true);
  });

  it('default rules: reads allowed, money and prod writes gated', () => {
    const p = new ZeroPolicy();
    for (const r of defaultPolicyRules()) p.addRule(r);

    assert.equal(p.decide({ agent: 'any', action: 'READ', environment: 'production' }), 'allow');
    assert.equal(p.decide({ agent: 'any', action: 'WRITE', environment: 'development' }), 'allow');
    assert.equal(p.decide({ agent: 'any', action: 'WRITE', environment: 'production' }), 'deny');
    assert.equal(p.decide({ agent: 'any', action: 'CHARGE_CARD', environment: 'production' }), 'approval-required');
    assert.equal(p.decide({ agent: 'any', action: 'DEPLOY', environment: 'production' }), 'approval-required');
    assert.equal(p.decide({ agent: 'any', action: 'ROTATE_SECRET', environment: 'development' }), 'approval-required');
  });
});
