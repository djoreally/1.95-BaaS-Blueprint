/**
 * ZeroPolicy: the deterministic permission broker. Models never decide their
 * own authority — they request it, the broker decides.
 *
 * Rules match on (agent, action, environment); '*' is a wildcard. The most
 * specific matching rule wins (exact segments beat wildcards). No matching
 * rule → deny. This is fail-closed by design.
 */
import type { AgentAction } from './types.js';

export type PolicyDecision = 'allow' | 'deny' | 'approval-required';

export interface PolicyRule {
  agent: string | '*';
  action: AgentAction | '*';
  environment: string | '*';
  decision: PolicyDecision;
}

export interface PolicyRequest {
  agent: string;
  action: AgentAction;
  environment: string;
}

export class PolicyDeniedError extends Error {
  readonly request: PolicyRequest;
  constructor(request: PolicyRequest) {
    super(`policy denied: agent "${request.agent}" may not ${request.action} in "${request.environment}"`);
    this.name = 'PolicyDeniedError';
    this.request = request;
  }
}

/** Specificity score: exact segments outrank wildcards. */
function specificity(rule: PolicyRule, req: PolicyRequest): number {
  let score = 0;
  if (rule.agent === req.agent) score += 4;
  else if (rule.agent !== '*') return -1;
  if (rule.action === req.action) score += 2;
  else if (rule.action !== '*') return -1;
  if (rule.environment === req.environment) score += 1;
  else if (rule.environment !== '*') return -1;
  return score;
}

export class ZeroPolicy {
  private rules: PolicyRule[] = [];

  addRule(rule: PolicyRule): void {
    this.rules.push({ ...rule });
  }

  removeRule(predicate: (r: PolicyRule) => boolean): number {
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => !predicate(r));
    return before - this.rules.length;
  }

  listRules(): PolicyRule[] {
    return this.rules.map((r) => ({ ...r }));
  }

  /**
   * Decide a request deterministically. Most-specific matching rule wins;
   * ties go to the earliest-added rule; no match → deny (fail-closed).
   */
  decide(req: PolicyRequest): PolicyDecision {
    let best: PolicyRule | undefined;
    let bestScore = -1;
    for (const rule of this.rules) {
      const score = specificity(rule, req);
      if (score > bestScore) {
        bestScore = score;
        best = rule;
      }
    }
    return best ? best.decision : 'deny';
  }

  /**
   * Enforce a request: returns true when allowed, throws PolicyDeniedError
   * when denied, and returns 'approval-required' (without throwing) when a
   * human approval must be collected out-of-band before proceeding.
   */
  check(req: PolicyRequest): true | 'approval-required' {
    const decision = this.decide(req);
    if (decision === 'deny') throw new PolicyDeniedError(req);
    return decision === 'allow' ? true : 'approval-required';
  }
}

/** Sensible starting rules: read-only by default, writes gated in production. */
export function defaultPolicyRules(): PolicyRule[] {
  return [
    { agent: '*', action: 'READ', environment: '*', decision: 'allow' },
    { agent: '*', action: '*', environment: 'development', decision: 'allow' },
    { agent: '*', action: 'CHARGE_CARD', environment: '*', decision: 'approval-required' },
    { agent: '*', action: 'SEND_EMAIL', environment: 'production', decision: 'approval-required' },
    { agent: '*', action: 'DELETE', environment: 'production', decision: 'approval-required' },
    { agent: '*', action: 'DEPLOY', environment: 'production', decision: 'approval-required' },
    { agent: '*', action: 'MODIFY_DATABASE', environment: 'production', decision: 'approval-required' },
    { agent: '*', action: 'ROTATE_SECRET', environment: '*', decision: 'approval-required' },
  ];
}
