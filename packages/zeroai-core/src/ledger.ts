import { createHash } from 'node:crypto';

export const GENESIS_PARENT = 'GENESIS';

export interface ZeroEvent {
  eventId: string;
  projectId: string;
  actor: string;
  action: string;
  timestamp: string;
  inputHash: string;
  outputHash?: string;
  parentHash: string;
  evidenceRefs: string[];
}

export interface AppendInput {
  projectId: string;
  actor: string;
  action: string;
  input: unknown;
  output?: unknown;
  evidenceRefs?: string[];
  timestamp?: string;
}

export interface VerifyResult {
  valid: boolean;
  brokenAt?: number;
  reason?: string;
}

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
  return `{${entries.join(',')}}`;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export class ZeroLedger {
  private events: ZeroEvent[] = [];

  append(input: AppendInput): ZeroEvent {
    const previous = this.events.at(-1);
    const parentHash = previous?.eventId ?? GENESIS_PARENT;
    const timestamp = input.timestamp ?? new Date().toISOString();
    const inputHash = sha256Hex(canonical(input.input));
    const outputHash = input.output === undefined ? undefined : sha256Hex(canonical(input.output));
    const evidenceRefs = input.evidenceRefs ?? [];

    const body = canonical({
      projectId: input.projectId,
      actor: input.actor,
      action: input.action,
      timestamp,
      inputHash,
      outputHash,
      parentHash,
      evidenceRefs,
    });

    const event: ZeroEvent = {
      eventId: sha256Hex(body),
      projectId: input.projectId,
      actor: input.actor,
      action: input.action,
      timestamp,
      inputHash,
      parentHash,
      evidenceRefs,
    };
    if (outputHash !== undefined) event.outputHash = outputHash;

    this.events.push(event);
    return { ...event, evidenceRefs: [...event.evidenceRefs] };
  }

  list(): readonly ZeroEvent[] {
    return this.events.map((event) => ({ ...event, evidenceRefs: [...event.evidenceRefs] }));
  }

  get length(): number {
    return this.events.length;
  }

  verify(): VerifyResult {
    for (let index = 0; index < this.events.length; index += 1) {
      const event = this.events[index];
      const expectedParent = index === 0 ? GENESIS_PARENT : this.events[index - 1].eventId;
      if (event.parentHash !== expectedParent) {
        return { valid: false, brokenAt: index, reason: `parentHash mismatch at index ${index}` };
      }

      const body = canonical({
        projectId: event.projectId,
        actor: event.actor,
        action: event.action,
        timestamp: event.timestamp,
        inputHash: event.inputHash,
        outputHash: event.outputHash,
        parentHash: event.parentHash,
        evidenceRefs: event.evidenceRefs,
      });
      if (sha256Hex(body) !== event.eventId) {
        return { valid: false, brokenAt: index, reason: `event hash mismatch at index ${index}` };
      }
    }

    return { valid: true };
  }

  export(): ZeroEvent[] {
    return this.list().map((event) => ({ ...event, evidenceRefs: [...event.evidenceRefs] }));
  }

  import(events: ZeroEvent[]): void {
    this.events = events.map((event) => ({ ...event, evidenceRefs: [...event.evidenceRefs] }));
  }
}
