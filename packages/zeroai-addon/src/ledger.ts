/**
 * ZeroLedger: the observation plane's tamper-evident record. Every meaningful
 * execution leaves an immutable, hash-chained audit entry:
 *
 *   event 001 → hash → event 002 → hash → event 003
 *
 * If old history is rewritten, the chain breaks — verify() detects it.
 * The certification engine evaluates evidence; the agent never certifies
 * itself.
 */
import { createHash } from 'node:crypto';
import type { ZeroEvent } from './types.js';

/** Deterministic JSON serialization so hashes are stable across runtimes. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
  return `{${entries.join(',')}}`;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export const GENESIS_PARENT = 'GENESIS';

export interface AppendInput {
  workspaceId: string;
  actor: string;
  action: string;
  /** Arbitrary input payload — hashed, never stored raw. */
  input: unknown;
  /** Arbitrary output payload — hashed, never stored raw. */
  output?: unknown;
  evidenceRefs?: string[];
  /** Override the timestamp (ISO-8601). Defaults to now. */
  timestamp?: string;
}

export interface VerifyResult {
  valid: boolean;
  /** Index of the first event that fails verification. */
  brokenAt?: number;
  reason?: string;
}

export class ZeroLedger {
  private events: ZeroEvent[] = [];

  /** Append an event, chaining it to the previous event's hash. */
  append(input: AppendInput): ZeroEvent {
    const previous = this.events[this.events.length - 1];
    const parentHash = previous ? previous.eventId : GENESIS_PARENT;
    const timestamp = input.timestamp ?? new Date().toISOString();
    const inputHash = sha256Hex(canonical(input.input));
    const outputHash = input.output === undefined ? undefined : sha256Hex(canonical(input.output));

    const body = canonical({
      workspaceId: input.workspaceId,
      actor: input.actor,
      action: input.action,
      timestamp,
      inputHash,
      outputHash,
      parentHash,
      evidenceRefs: input.evidenceRefs ?? [],
    });
    const event: ZeroEvent = {
      eventId: sha256Hex(body),
      workspaceId: input.workspaceId,
      actor: input.actor,
      action: input.action,
      timestamp,
      inputHash,
      parentHash,
      evidenceRefs: input.evidenceRefs ?? [],
    };
    if (outputHash !== undefined) event.outputHash = outputHash;
    this.events.push(event);
    return { ...event };
  }

  /** Read-only view of the chain. */
  list(): readonly ZeroEvent[] {
    return this.events.map((e) => ({ ...e }));
  }

  get length(): number {
    return this.events.length;
  }

  /**
   * Recompute every event's hash and parent linkage. Returns the index of
   * the first broken event — any mutation of a stored event (action, actor,
   * timestamp, hashes, evidence refs) is detected.
   */
  verify(): VerifyResult {
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i];
      const expectedParent = i === 0 ? GENESIS_PARENT : this.events[i - 1].eventId;
      if (e.parentHash !== expectedParent) {
        return { valid: false, brokenAt: i, reason: `parentHash mismatch at index ${i}` };
      }
      const body = canonical({
        workspaceId: e.workspaceId,
        actor: e.actor,
        action: e.action,
        timestamp: e.timestamp,
        inputHash: e.inputHash,
        outputHash: e.outputHash,
        parentHash: e.parentHash,
        evidenceRefs: e.evidenceRefs,
      });
      if (sha256Hex(body) !== e.eventId) {
        return { valid: false, brokenAt: i, reason: `event hash mismatch at index ${i}` };
      }
    }
    return { valid: true };
  }

  /** Export for durable storage (e.g. a seat's Postgres). */
  export(): ZeroEvent[] {
    return this.list().map((e) => ({ ...e }));
  }

  /** Restore a previously exported chain (still subject to verify()). */
  import(events: ZeroEvent[]): void {
    this.events = events.map((e) => ({ ...e }));
  }
}
