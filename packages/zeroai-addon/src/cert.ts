/**
 * ZeroCert: evidence-driven certification. A requirement maps to a state plus
 * the evidence behind it. The certification engine evaluates evidence; the
 * agent does not certify itself.
 *
 * Rule: no evidence = UNKNOWN, never success.
 */
import type { CertificationRecord, EvidenceState } from './types.js';

export interface EvidenceInput {
  /** Explicit state wins when provided and valid. */
  state?: EvidenceState;
  /** Deterministic outcome flag. */
  passed?: boolean;
  /** Partial completion flag (only meaningful when passed is not false). */
  partial?: boolean;
  [key: string]: unknown;
}

function isEvidenceState(s: unknown): s is EvidenceState {
  return s === 'VERIFIED' || s === 'PARTIAL' || s === 'UNKNOWN' || s === 'FAILED';
}

export class ZeroCert {
  private records = new Map<string, CertificationRecord>();

  /**
   * Certify a requirement against evidence. Deterministic mapping:
   * explicit valid state → used as-is; passed=true → VERIFIED;
   * passed=false → FAILED; partial=true → PARTIAL; anything else → UNKNOWN.
   */
  certify(requirement: string, evidence?: EvidenceInput): CertificationRecord {
    const state = resolveState(evidence);
    const record: CertificationRecord = {
      requirement,
      state,
      evidence: evidence ? { ...evidence } : {},
      evaluatedAt: new Date().toISOString(),
    };
    this.records.set(requirement, record);
    return { ...record, evidence: { ...record.evidence } };
  }

  get(requirement: string): CertificationRecord | undefined {
    const r = this.records.get(requirement);
    return r ? { ...r, evidence: { ...r.evidence } } : undefined;
  }

  all(): CertificationRecord[] {
    return [...this.records.values()].map((r) => ({ ...r, evidence: { ...r.evidence } }));
  }

  summary(): Record<EvidenceState, number> {
    const counts: Record<EvidenceState, number> = { VERIFIED: 0, PARTIAL: 0, UNKNOWN: 0, FAILED: 0 };
    for (const r of this.records.values()) counts[r.state]++;
    return counts;
  }

  /** True only when every recorded requirement is VERIFIED. */
  allVerified(): boolean {
    if (this.records.size === 0) return false;
    for (const r of this.records.values()) {
      if (r.state !== 'VERIFIED') return false;
    }
    return true;
  }
}

function resolveState(evidence?: EvidenceInput): EvidenceState {
  if (!evidence || Object.keys(evidence).length === 0) return 'UNKNOWN';
  if (isEvidenceState(evidence.state)) return evidence.state;
  if (evidence.passed === false) return 'FAILED';
  if (evidence.passed === true) return 'VERIFIED';
  if (evidence.partial === true) return 'PARTIAL';
  return 'UNKNOWN';
}
