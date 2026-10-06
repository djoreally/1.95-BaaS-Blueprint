/**
 * ZeroMemory: the memory plane. Never shove entire chat histories back into
 * the model — maintain a compact fact graph with salience scoring, dedupe,
 * conflict resolution, and compaction to a byte budget. The AI sees the
 * smallest sufficient state.
 *
 * Pipeline: raw events → facts → dedupe → conflict resolution →
 * salience scoring → compaction → active memory.
 */

export type FactCategory =
  | 'identity'
  | 'projects'
  | 'facts'
  | 'recent'
  | 'patterns'
  | 'issues'
  | 'reserve';

export interface Fact {
  id: string;
  category: FactCategory;
  /** Stable dedupe/conflict key, e.g. "user.timezone". Empty = no key. */
  key: string;
  content: string;
  /** 0..1 — higher survives compaction longer. */
  salience: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  /** Ids of facts this one supersedes (conflict resolution). */
  supersededBy?: string;
}

/** Pluggable durable store. Swap the in-memory default for Postgres/Neon. */
export interface MemoryStore {
  put(fact: Fact): void | Promise<void>;
  get(id: string): Fact | undefined | Promise<Fact | undefined>;
  list(): Fact[] | Promise<Fact[]>;
  remove(id: string): void | Promise<void>;
  clear(): void | Promise<void>;
}

export class InMemoryStore implements MemoryStore {
  private facts = new Map<string, Fact>();
  put(fact: Fact): void {
    this.facts.set(fact.id, { ...fact });
  }
  get(id: string): Fact | undefined {
    const f = this.facts.get(id);
    return f ? { ...f } : undefined;
  }
  list(): Fact[] {
    return [...this.facts.values()].map((f) => ({ ...f }));
  }
  remove(id: string): void {
    this.facts.delete(id);
  }
  clear(): void {
    this.facts.clear();
  }
}

/** Typical operating target: 128–256 KB of active memory. */
export const ACTIVE_MEMORY_TARGET_BYTES = 192 * 1024;
/** Hard ceiling: active memory never exceeds 1 MB. */
export const ACTIVE_MEMORY_MAX_BYTES = 1024 * 1024;

export interface RememberOptions {
  key?: string;
  /** 0..1, defaults to 0.5. */
  salience?: number;
  source?: string;
}

export interface CompactionReport {
  kept: number;
  dropped: number;
  bytesBefore: number;
  bytesAfter: number;
  budgetBytes: number;
}

const normalize = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

export class ZeroMemory {
  private store: MemoryStore;
  private seq = 0;

  constructor(store: MemoryStore = new InMemoryStore()) {
    this.store = store;
  }

  /**
   * Record a fact. Dedupe: identical normalized content bumps the existing
   * fact's salience instead of adding a duplicate. Conflict resolution: a
   * fact with the same non-empty key but different content supersedes the
   * older one (old fact is marked, not deleted — history is preserved).
   */
  async remember(content: string, category: FactCategory, opts: RememberOptions = {}): Promise<Fact> {
    const key = opts.key ?? '';
    const salience = opts.salience ?? 0.5;
    const facts = await this.store.list();
    const norm = normalize(content);

    const duplicate = facts.find((f) => !f.supersededBy && normalize(f.content) === norm);
    if (duplicate) {
      duplicate.salience = Math.min(1, duplicate.salience + 0.1);
      duplicate.updatedAt = new Date().toISOString();
      await this.store.put(duplicate);
      return duplicate;
    }

    const now = new Date().toISOString();
    const fact: Fact = {
      id: `fact-${Date.now().toString(36)}-${(this.seq++).toString(36)}`,
      category,
      key,
      content: content.trim(),
      salience: Math.max(0, Math.min(1, salience)),
      source: opts.source ?? 'agent',
      createdAt: now,
      updatedAt: now,
    };

    if (key) {
      for (const older of facts) {
        if (!older.supersededBy && older.key === key && normalize(older.content) !== norm) {
          older.supersededBy = fact.id;
          older.salience = Math.max(0, older.salience - 0.3);
          older.updatedAt = now;
          await this.store.put(older);
        }
      }
    }

    await this.store.put(fact);
    return fact;
  }

  /** Top facts by salience (superseded excluded unless asked). */
  async recall(limit = 50, includeSuperseded = false): Promise<Fact[]> {
    const facts = await this.store.list();
    return facts
      .filter((f) => includeSuperseded || !f.supersededBy)
      .sort((a, b) => b.salience - a.salience || a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  async forget(id: string): Promise<void> {
    await this.store.remove(id);
  }

  static byteSize(facts: Fact[]): number {
    return Buffer.byteLength(JSON.stringify(facts), 'utf8');
  }

  /**
   * Compact to a byte budget: keep highest-salience facts until the budget
   * is exhausted. Dropped facts are removed from the store. Returns a report.
   */
  async compact(budgetBytes: number = ACTIVE_MEMORY_TARGET_BYTES): Promise<CompactionReport> {
    const facts = await this.recall(Number.MAX_SAFE_INTEGER);
    const bytesBefore = ZeroMemory.byteSize(facts);
    const kept: Fact[] = [];
    let bytes = 0;
    for (const f of facts) {
      const size = Buffer.byteLength(JSON.stringify(f), 'utf8');
      if (bytes + size > budgetBytes && kept.length > 0) break;
      kept.push(f);
      bytes += size;
    }
    const keptIds = new Set(kept.map((f) => f.id));
    let dropped = 0;
    for (const f of facts) {
      if (!keptIds.has(f.id)) {
        await this.store.remove(f.id);
        dropped++;
      }
    }
    return {
      kept: kept.length,
      dropped,
      bytesBefore,
      bytesAfter: bytes,
      budgetBytes,
    };
  }

  /**
   * Serialize the active memory: highest-salience facts within budget.
   * Never exceeds the 1 MB hard ceiling regardless of the requested budget.
   */
  async activeMemory(budgetBytes: number = ACTIVE_MEMORY_TARGET_BYTES): Promise<string> {
    const budget = Math.min(budgetBytes, ACTIVE_MEMORY_MAX_BYTES);
    const facts = await this.recall(Number.MAX_SAFE_INTEGER);
    const kept: Fact[] = [];
    let bytes = 0;
    for (const f of facts) {
      const size = Buffer.byteLength(JSON.stringify(f), 'utf8');
      if (bytes + size > budget && kept.length > 0) break;
      kept.push(f);
      bytes += size;
    }
    return JSON.stringify(kept);
  }
}
