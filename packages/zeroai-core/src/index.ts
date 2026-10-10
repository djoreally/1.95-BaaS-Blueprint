export type ZeroActorType = 'user' | 'agent' | 'service' | 'system';
export type ZeroRisk = 'low' | 'medium' | 'high' | 'critical';
export type ZeroEffect = 'read' | 'reversible_write' | 'irreversible_write' | 'external_effect';
export type ZeroDecision = 'allow' | 'deny' | 'require_approval';
export type ZeroGateStatus = 'pass' | 'fail' | 'skip';
export type ZeroChangeClass = 'ui' | 'logic' | 'schema' | 'policy' | 'integration' | 'critical';
export type ZeroEnvironment = 'blue' | 'green';

export interface ZeroActor {
  id: string;
  type: ZeroActorType;
  projectId: string;
  capabilities: string[];
}

export interface ZeroAction {
  id: string;
  capability: string;
  resource: string;
  effect: ZeroEffect;
  risk: ZeroRisk;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ZeroPolicyRule {
  id: string;
  capability: string;
  effect?: ZeroEffect;
  riskAtOrAbove?: ZeroRisk;
  decision: ZeroDecision;
}

export interface ZeroPolicyResult {
  decision: ZeroDecision;
  ruleId?: string;
  reason: string;
}

const riskRank: Record<ZeroRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function evaluatePolicy(
  actor: ZeroActor,
  action: ZeroAction,
  rules: readonly ZeroPolicyRule[],
): ZeroPolicyResult {
  if (!actor.capabilities.includes(action.capability)) {
    return { decision: 'deny', reason: `missing capability: ${action.capability}` };
  }

  const matching = rules.find((rule) => {
    if (rule.capability !== action.capability) return false;
    if (rule.effect && rule.effect !== action.effect) return false;
    if (rule.riskAtOrAbove && riskRank[action.risk] < riskRank[rule.riskAtOrAbove]) return false;
    return true;
  });

  if (matching) {
    return { decision: matching.decision, ruleId: matching.id, reason: `matched policy ${matching.id}` };
  }

  if (action.effect === 'irreversible_write' || action.effect === 'external_effect' || action.risk === 'critical') {
    return { decision: 'require_approval', reason: 'sensitive action requires explicit approval by default' };
  }

  return { decision: 'allow', reason: 'capability granted and no stricter rule matched' };
}

export interface ZeroGateResult {
  id: string;
  plane: 'white' | 'grey' | 'black' | 'red' | 'performance';
  status: ZeroGateStatus;
  required: boolean;
  summary: string;
  evidence?: Readonly<Record<string, unknown>>;
}

export interface ZeroGateDecision {
  approved: boolean;
  blocking: ZeroGateResult[];
}

export function evaluateGates(results: readonly ZeroGateResult[]): ZeroGateDecision {
  const blocking = results.filter((result) => result.required && result.status !== 'pass');
  return { approved: blocking.length === 0, blocking };
}

export interface ZeroLedgerEntry {
  id: string;
  projectId: string;
  occurredAt: string;
  actor: ZeroActor;
  action: ZeroAction;
  decision: ZeroDecision;
  outcome: 'success' | 'failure' | 'blocked' | 'cancelled';
  previousHash?: string;
  entryHash: string;
  evidence?: Readonly<Record<string, unknown>>;
}

export interface ZeroDeploymentCandidate {
  id: string;
  projectId: string;
  active: ZeroEnvironment;
  candidate: ZeroEnvironment;
  changeClass: ZeroChangeClass;
  sourceSchemaVersion: string;
  targetSchemaVersion: string;
  writerFenceRequired: boolean;
}

export const requiredTestPlanes: Record<ZeroChangeClass, readonly ZeroGateResult['plane'][]> = {
  ui: ['black'],
  logic: ['white', 'grey', 'black'],
  schema: ['white', 'grey', 'black', 'red', 'performance'],
  policy: ['white', 'grey', 'black', 'red'],
  integration: ['white', 'grey', 'black', 'red'],
  critical: ['white', 'grey', 'black', 'red', 'performance'],
};
