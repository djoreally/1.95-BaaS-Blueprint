import type { ZeroDeploymentCandidate, ZeroGateDecision } from './contracts.js';

export type ZeroDeploymentState =
  | 'proposed'
  | 'candidate_ready'
  | 'testing'
  | 'blocked'
  | 'approved'
  | 'fenced'
  | 'promoted'
  | 'rolled_back';

export interface ZeroDeploymentRecord extends ZeroDeploymentCandidate {
  state: ZeroDeploymentState;
  gateDecision?: ZeroGateDecision;
  writerFenceSatisfied: boolean;
  promotedAt?: string;
  rolledBackAt?: string;
}

export class ZeroDeploymentMachine {
  private record: ZeroDeploymentRecord;

  constructor(candidate: ZeroDeploymentCandidate) {
    if (candidate.active === candidate.candidate) {
      throw new Error('active and candidate environments must be different');
    }
    this.record = {
      ...candidate,
      state: 'proposed',
      writerFenceSatisfied: false,
    };
  }

  snapshot(): ZeroDeploymentRecord {
    return {
      ...this.record,
      gateDecision: this.record.gateDecision
        ? { ...this.record.gateDecision, blocking: [...this.record.gateDecision.blocking] }
        : undefined,
    };
  }

  candidateReady(): ZeroDeploymentRecord {
    this.requireState('proposed');
    this.record.state = 'candidate_ready';
    return this.snapshot();
  }

  beginTesting(): ZeroDeploymentRecord {
    this.requireState('candidate_ready');
    this.record.state = 'testing';
    return this.snapshot();
  }

  applyGateDecision(decision: ZeroGateDecision): ZeroDeploymentRecord {
    this.requireState('testing');
    this.record.gateDecision = {
      ...decision,
      blocking: [...decision.blocking],
    };
    this.record.state = decision.approved ? 'approved' : 'blocked';
    return this.snapshot();
  }

  satisfyWriterFence(): ZeroDeploymentRecord {
    if (this.record.state !== 'approved') {
      throw new Error(`writer fence can only be satisfied after approval; current state=${this.record.state}`);
    }
    this.record.writerFenceSatisfied = true;
    this.record.state = 'fenced';
    return this.snapshot();
  }

  promote(at = new Date().toISOString()): ZeroDeploymentRecord {
    if (!this.record.gateDecision?.approved) {
      throw new Error('promotion requires an approved ZeroGate decision');
    }

    if (this.record.writerFenceRequired && !this.record.writerFenceSatisfied) {
      throw new Error('promotion requires writer fence synchronization');
    }

    if (this.record.writerFenceRequired && this.record.state !== 'fenced') {
      throw new Error(`fenced deployment must be in fenced state before promotion; current state=${this.record.state}`);
    }

    if (!this.record.writerFenceRequired && this.record.state !== 'approved') {
      throw new Error(`deployment must be approved before promotion; current state=${this.record.state}`);
    }

    const previousActive = this.record.active;
    this.record.active = this.record.candidate;
    this.record.candidate = previousActive;
    this.record.state = 'promoted';
    this.record.promotedAt = at;
    return this.snapshot();
  }

  rollback(at = new Date().toISOString()): ZeroDeploymentRecord {
    this.requireState('promoted');
    const previousActive = this.record.active;
    this.record.active = this.record.candidate;
    this.record.candidate = previousActive;
    this.record.state = 'rolled_back';
    this.record.rolledBackAt = at;
    return this.snapshot();
  }

  private requireState(expected: ZeroDeploymentState): void {
    if (this.record.state !== expected) {
      throw new Error(`invalid deployment transition: expected ${expected}, got ${this.record.state}`);
    }
  }
}
