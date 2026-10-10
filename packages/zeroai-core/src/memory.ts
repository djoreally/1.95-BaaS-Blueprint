/** Native ZeroMemory plane for InvisibleDB. */
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
  key: string;
  content: string;
  salience: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  supersededBy?: string;
}

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
    const fact = this.facts.get(id);
    return fact ? { ...fact } : undefined;
  }

  list(): Fact[] {
    return [...this.facts.values()].map((fact) => ({ ...fact }));
  }

  remove(id: string): void {
    this.facts.delete(id);
  }

  clear(): void {
    this.facts.clear();
  }
}

export const ACTIVE_MEMORY_TARGET_BYTES = 192 * 1024;
export const ACTIVE_MEMORY_MAX_BYTES = 1024 * 1024;

export interface RememberOptions {
  key?: string;
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

const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

export class ZeroMemory {
  private seq = 0;

  constructor(private readonly store: MemoryStore = new InMemoryStore()) {}

  async remember(content: string, category: FactCategory, opts: RememberOptions = {}): Promise<Fact> {
    const key = opts.key ?? '';
    const facts = await this.store.list();
    const normalized = normalize(content);

    const duplicate = facts.find((fact) => !fact.supersededBy && normalize(fact.content) === normalized);
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
      salience: Math.max(0, Math.min(1, opts.salience ?? 0.5)),
      source: opts.source ?? 'agent',
      createdAt: now,
      updatedAt: now,
    };

    if (key) {
      for (const older of facts) {
        if (!older.supersededBy && older.key === key && normalize(older.content) !== normalized) {
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

  async recall(limit = 50, includeSuperseded = false): Promise<Fact[]> {
    const facts = await this.store.list();
    return facts
      .filter((fact) => includeSuperseded || !fact.supersededBy)
      .sort((a, b) => b.salience - a.salience || a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  async forget(id: string): Promise<void> {
    await this.store.remove(id);
  }

  static byteSize(facts: Fact[]): number {
    return Buffer.byteLength(JSON.stringify(facts), 'utf8');
  }

  async compact(budgetBytes = ACTIVE_MEMORY_TARGET_BYTES): Promise<CompactionReport> {
    const budget = Math.min(Math.max(0, budgetBytes), ACTIVE_MEMORY_MAX_BYTES);
    const facts = await this.recall(Number.MAX_SAFE_INTEGER);
    const bytesBefore = ZeroMemory.byteSize(facts);
    const kept: Fact[] = [];
    let bytesAfter = 0;

    for (const fact of facts) {
      const bytes = Buffer.byteLength(JSON.stringify(fact), 'utf8');
      if (bytesAfter + bytes > budget && kept.length > 0) break;
      if (bytes > budget && kept.length === 0) break;
      kept.push(fact);
      bytesAfter += bytes;
    }

    const keptIds = new Set(kept.map((fact) => fact.id));
    let dropped = 0;
    for (const fact of facts) {
      if (!keptIds.has(fact.id)) {
        await this.store.remove(fact.id);
        dropped += 1;
      }
    }

    return { kept: kept.length, dropped, bytesBefore, bytesAfter, budgetBytes: budget };
  }

  async activeMemory(budgetBytes = ACTIVE_MEMORY_TARGET_BYTES): Promise<string> {
    const budget = Math.min(Math.max(0, budgetBytes), ACTIVE_MEMORY_MAX_BYTES);
    const facts = await this.recall(Number.MAX_SAFE_INTEGER);
    const kept: Fact[] = [];
    let bytes = 0;

    for (const fact of facts) {
      const size = Buffer.byteLength(JSON.stringify(fact), 'utf8');
      if (bytes + size > budget) break;
      kept.push(fact);
      bytes += size;
    }

    return JSON.stringify(kept);
  }
}
