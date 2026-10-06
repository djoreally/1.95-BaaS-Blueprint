/**
 * ZeroGate: deterministic lifecycle gates. Every important state transition
 * has a gate; a failed gate blocks the transition — not because the AI thinks
 * it should, but because the state machine says it must.
 *
 * Gates evaluate EVIDENCE (see ZeroCert), never model opinion. Missing
 * evidence evaluates to UNKNOWN, which blocks — fail-closed.
 */
import type { EvidenceState } from './types.js';

/** Evidence available to gate evaluators, keyed by gate id. */
export type GateContext = Record<string, unknown>;

export interface Gate {
  id: string;
  description: string;
  /**
   * Return the evidence state for this gate from the context. May be async
   * when evidence lives behind an API call — the evaluation itself stays
   * deterministic: same context, same verdict.
   */
  evaluate: (ctx: GateContext) => EvidenceState | Promise<EvidenceState>;
}

export interface GateResult {
  gateId: string;
  passed: boolean;
  evidence: EvidenceState;
}

export interface GateSetResult {
  passed: boolean;
  /** Id of the first failing gate; undefined when all pass. */
  blockedAt?: string;
  results: GateResult[];
}

/** A gate passes only on VERIFIED evidence. PARTIAL/UNKNOWN/FAILED block. */
export function gatePassed(evidence: EvidenceState): boolean {
  return evidence === 'VERIFIED';
}

/**
 * Evaluate gates in order, stopping at the first failure. Later gates are
 * NOT evaluated once blocked — the verdict is deterministic and minimal.
 */
export async function evaluateGateSet(gates: Gate[], ctx: GateContext): Promise<GateSetResult> {
  const results: GateResult[] = [];
  for (const gate of gates) {
    const evidence = await gate.evaluate(ctx);
    const passed = gatePassed(evidence);
    results.push({ gateId: gate.id, passed, evidence });
    if (!passed) {
      return { passed: false, blockedAt: gate.id, results };
    }
  }
  return { passed: true, results };
}

/**
 * Build a gate whose evidence comes from a context key holding either an
 * EvidenceState string or { state: EvidenceState }. Absent keys → UNKNOWN.
 */
export function contextGate(id: string, description: string): Gate {
  return {
    id,
    description,
    evaluate: (ctx: GateContext): EvidenceState => {
      const raw = ctx[id];
      if (typeof raw === 'string' && isEvidenceState(raw)) return raw;
      if (raw && typeof raw === 'object') {
        const state = (raw as Record<string, unknown>).state;
        if (typeof state === 'string' && isEvidenceState(state)) return state;
      }
      return 'UNKNOWN';
    },
  };
}

function isEvidenceState(s: string): s is EvidenceState {
  return s === 'VERIFIED' || s === 'PARTIAL' || s === 'UNKNOWN' || s === 'FAILED';
}

/**
 * The default software-release gate set from the ZeroAI spec:
 * code-complete → typecheck → unit-tests → integration-tests →
 * crud-certification → security → migration-safety → e2e →
 * production-readiness → release.
 */
export function softwareReleaseGates(): Gate[] {
  const defs: Array<[string, string]> = [
    ['code-complete', 'All planned code changes are implemented'],
    ['typecheck', 'Static type checking passes with zero errors'],
    ['unit-tests', 'Unit test suite passes'],
    ['integration-tests', 'Integration test suite passes'],
    ['crud-certification', 'CRUD paths certified against a live environment'],
    ['security', 'Security review complete, no open findings'],
    ['migration-safety', 'Data migrations are reversible and tested'],
    ['e2e', 'End-to-end tests pass'],
    ['production-readiness', 'Runbooks, monitoring, and rollback plan in place'],
    ['release', 'Release authorized'],
  ];
  return defs.map(([id, description]) => contextGate(id, description));
}
