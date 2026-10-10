export type EvidenceState = 'VERIFIED' | 'PARTIAL' | 'UNKNOWN' | 'FAILED';

export interface CertificationRecord {
  requirement: string;
  state: EvidenceState;
  evidence: Record<string, unknown>;
  evaluatedAt: string;
}

export interface EvidenceInput {
  state?: EvidenceState;
  passed?: boolean;
  partial?: boolean;
  [key: string]: unknown;
}

function isEvidenceState(value: unknown): value is EvidenceState {
  return value === 'VERIFIED' || value === 'PARTIAL' || value === 'UNKNOWN' || value === 'FAILED';
}

export function resolveEvidenceState(evidence?: EvidenceInput): EvidenceState {
  if (!evidence || Object.keys(evidence).length === 0) return 'UNKNOWN';
  if (isEvidenceState(evidence.state)) return evidence.state;
  if (evidence.passed === false) return 'FAILED';
  if (evidence.passed === true) return 'VERIFIED';
  if (evidence.partial === true) return 'PARTIAL';
  return 'UNKNOWN';
}

export class ZeroCert {
  private readonly records = new Map<string, CertificationRecord>();

  certify(requirement: string, evidence?: EvidenceInput): CertificationRecord {
    const record: CertificationRecord = {
      requirement,
      state: resolveEvidenceState(evidence),
      evidence: evidence ? { ...evidence } : {},
      evaluatedAt: new Date().toISOString(),
    };
    this.records.set(requirement, record);
    return { ...record, evidence: { ...record.evidence } };
  }

  get(requirement: string): CertificationRecord | undefined {
    const record = this.records.get(requirement);
    return record ? { ...record, evidence: { ...record.evidence } } : undefined;
  }

  all(): CertificationRecord[] {
    return [...this.records.values()].map((record) => ({ ...record, evidence: { ...record.evidence } }));
  }

  summary(): Record<EvidenceState, number> {
    const counts: Record<EvidenceState, number> = { VERIFIED: 0, PARTIAL: 0, UNKNOWN: 0, FAILED: 0 };
    for (const record of this.records.values()) counts[record.state] += 1;
    return counts;
  }

  allVerified(): boolean {
    return this.records.size > 0 && [...this.records.values()].every((record) => record.state === 'VERIFIED');
  }
}
