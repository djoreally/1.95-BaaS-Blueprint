export type SourceProvider = 'lovable-cloud' | 'supabase' | 'postgres' | 'firebase' | 'pocketbase' | 'custom';

export interface SourceColumn {
  name: string;
  sourceType: string;
  nullable?: boolean;
  default?: string | null;
  enumValues?: string[];
}

export interface SourceForeignKey {
  column: string;
  referencesTable: string;
  referencesColumn: string;
  onDelete?: string;
}

export interface SourcePolicy {
  name: string;
  command?: string;
  using?: string | null;
  check?: string | null;
  roles?: string[];
}

export interface SourceTable {
  name: string;
  rowCount?: number;
  primaryKey?: string[];
  columns: SourceColumn[];
  foreignKeys?: SourceForeignKey[];
  indexes?: Array<{ name: string; columns: string[]; unique?: boolean }>;
  policies?: SourcePolicy[];
  triggers?: Array<{ name: string; definition?: string }>;
}

export interface MigrationManifest {
  version: '1.0';
  source: {
    provider: SourceProvider;
    engine: 'postgres' | 'sqlite' | 'mysql' | 'document' | 'unknown';
    projectId?: string;
    capturedAt: string;
  };
  tables: SourceTable[];
  auth?: {
    provider?: string;
    usersCount?: number;
    passwordHashExportable?: boolean;
    userTable?: string;
  };
  storage?: {
    buckets: Array<{ name: string; objectsCount?: number; bytes?: number }>;
  };
  functions?: Array<{ name: string; language?: string; definition?: string }>;
  realtime?: Array<{ table: string; events?: string[] }>;
  extensions?: string[];
  metadata?: Record<string, unknown>;
}

export type DestinationFieldType = 'text' | 'number' | 'bool' | 'date' | 'json' | 'relation' | 'file' | 'email' | 'url' | 'select';

export interface DestinationField {
  name: string;
  type: DestinationFieldType;
  required: boolean;
  sourceType: string;
  options?: Record<string, unknown>;
  relation?: { collection: string; sourceColumn: string; sourceTable: string };
}

export interface DestinationCollection {
  sourceTable: string;
  name: string;
  type: 'base' | 'auth';
  primaryKey: string;
  fields: DestinationField[];
  rules: { list: string | null; view: string | null; create: string | null; update: string | null; delete: string | null };
  expectedRows: number | null;
}

export interface MigrationPlan {
  manifestVersion: '1.0';
  sourceProvider: SourceProvider;
  compatibility: number;
  collections: DestinationCollection[];
  warnings: string[];
  blockers: string[];
  steps: Array<{ id: string; title: string; automatic: boolean; detail: string }>;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertMigrationManifest(input: unknown): asserts input is MigrationManifest {
  if (!input || typeof input !== 'object') throw new Error('manifest must be an object');
  const m = input as Partial<MigrationManifest>;
  if (m.version !== '1.0') throw new Error('manifest.version must be 1.0');
  if (!m.source || typeof m.source !== 'object' || !m.source.provider || !m.source.engine || !m.source.capturedAt) {
    throw new Error('manifest.source is incomplete');
  }
  if (!Array.isArray(m.tables)) throw new Error('manifest.tables must be an array');
  const names = new Set<string>();
  for (const table of m.tables) {
    if (!table || typeof table.name !== 'string' || !table.name.trim()) throw new Error('every table requires a name');
    if (names.has(table.name)) throw new Error(`duplicate table: ${table.name}`);
    names.add(table.name);
    if (!Array.isArray(table.columns) || table.columns.length === 0) throw new Error(`table ${table.name} has no columns`);
    const columns = new Set<string>();
    for (const column of table.columns) {
      if (!column.name || !column.sourceType) throw new Error(`table ${table.name} contains an invalid column`);
      if (columns.has(column.name)) throw new Error(`duplicate column ${table.name}.${column.name}`);
      columns.add(column.name);
    }
  }
}

function safeName(value: string): string {
  let out = value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!out) out = 'collection';
  if (!/^[a-z]/.test(out)) out = `m_${out}`;
  return out.slice(0, 63);
}

function mapType(column: SourceColumn): DestinationField {
  const t = column.sourceType.toLowerCase().replace(/\s+/g, ' ');
  const required = column.nullable === false && column.default == null;
  if (column.enumValues?.length) return { name: safeName(column.name), type: 'select', required, sourceType: column.sourceType, options: { values: column.enumValues, maxSelect: 1 } };
  if (/bool/.test(t)) return { name: safeName(column.name), type: 'bool', required, sourceType: column.sourceType };
  if (/(smallint|integer|bigint|serial|numeric|decimal|real|double|money)/.test(t)) return { name: safeName(column.name), type: 'number', required, sourceType: column.sourceType };
  if (/(timestamp|date|time)/.test(t)) return { name: safeName(column.name), type: 'date', required, sourceType: column.sourceType };
  if (/(json|jsonb|array|\[\])/.test(t)) return { name: safeName(column.name), type: 'json', required, sourceType: column.sourceType };
  if (/email/.test(column.name.toLowerCase())) return { name: safeName(column.name), type: 'email', required, sourceType: column.sourceType };
  if (/url/.test(column.name.toLowerCase())) return { name: safeName(column.name), type: 'url', required, sourceType: column.sourceType };
  return { name: safeName(column.name), type: 'text', required, sourceType: column.sourceType };
}

function cleanPolicy(expr: string): string {
  return expr.replace(/::[a-zA-Z0-9_\[\] ]+/g, '').replace(/\s+/g, ' ').trim();
}

export function translatePolicy(expression: string | null | undefined, fieldMap: Map<string, string>): { rule: string | null; supported: boolean } {
  if (!expression) return { rule: null, supported: true };
  let e = cleanPolicy(expression).replace(/^\((.*)\)$/s, '$1').trim();
  if (/^(true|TRUE)$/.test(e)) return { rule: '', supported: true };
  e = e.replace(/auth\.uid\(\)/gi, '@request.auth.id');
  e = e.replace(/auth\.role\(\)/gi, '@request.auth.role');
  e = e.replace(/\bAND\b/gi, '&&').replace(/\bOR\b/gi, '||');
  e = e.replace(/\bIS NOT NULL\b/gi, '!= null').replace(/\bIS NULL\b/gi, '= null');
  for (const [source, dest] of fieldMap) e = e.replace(new RegExp(`\\b${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), dest);
  const unsupported = /(select\s|exists\s*\(|current_setting\s*\(|jwt\s*\(|->>|\bANY\s*\(|\bALL\s*\()/i.test(e);
  return { rule: unsupported ? null : e, supported: !unsupported };
}

export function compileMigrationPlan(manifest: MigrationManifest): MigrationPlan {
  assertMigrationManifest(manifest);
  const warnings: string[] = [];
  const blockers: string[] = [];
  const tableNames = new Map(manifest.tables.map((t) => [t.name, safeName(t.name)]));
  const authSource = manifest.auth?.userTable;

  const collections: DestinationCollection[] = manifest.tables.map((table) => {
    const fieldMap = new Map(table.columns.map((c) => [c.name, safeName(c.name)]));
    const pk = table.primaryKey?.[0] ?? table.columns.find((c) => c.name === 'id')?.name ?? table.columns[0].name;
    if ((table.primaryKey?.length ?? 0) > 1) warnings.push(`${table.name}: composite primary key will be deterministically folded into one PocketBase id`);
    let fields = table.columns.filter((c) => c.name !== pk).map(mapType);
    fields.push({ name: '_source_id', type: 'text', required: true, sourceType: 'migration-identity' });

    for (const fk of table.foreignKeys ?? []) {
      const idx = fields.findIndex((f) => f.name === safeName(fk.column));
      if (idx < 0) continue;
      const target = tableNames.get(fk.referencesTable);
      if (!target) {
        blockers.push(`${table.name}.${fk.column}: referenced table ${fk.referencesTable} is missing from the manifest`);
        continue;
      }
      fields[idx] = {
        name: safeName(fk.column), type: 'relation', required: table.columns.find((c) => c.name === fk.column)?.nullable === false,
        sourceType: table.columns.find((c) => c.name === fk.column)?.sourceType ?? 'relation',
        relation: { collection: target, sourceColumn: fk.referencesColumn, sourceTable: fk.referencesTable },
      };
    }

    const rules = { list: null as string | null, view: null as string | null, create: null as string | null, update: null as string | null, delete: null as string | null };
    for (const policy of table.policies ?? []) {
      const translated = translatePolicy(policy.using ?? policy.check, fieldMap);
      if (!translated.supported) {
        blockers.push(`${table.name}: RLS policy "${policy.name}" requires manual translation`);
        continue;
      }
      const command = (policy.command || 'ALL').toUpperCase();
      if (command === 'SELECT' || command === 'ALL') { rules.list = translated.rule; rules.view = translated.rule; }
      if (command === 'INSERT' || command === 'ALL') rules.create = translated.rule;
      if (command === 'UPDATE' || command === 'ALL') rules.update = translated.rule;
      if (command === 'DELETE' || command === 'ALL') rules.delete = translated.rule;
    }
    if ((table.triggers?.length ?? 0) > 0) {
      for (const trigger of table.triggers ?? []) {
        if (!/updated_at|set.*timestamp|moddatetime/i.test(`${trigger.name} ${trigger.definition ?? ''}`)) blockers.push(`${table.name}: trigger "${trigger.name}" requires application/server translation`);
        else warnings.push(`${table.name}: trigger "${trigger.name}" maps to automatic updated timestamp behavior`);
      }
    }
    return {
      sourceTable: table.name,
      name: tableNames.get(table.name)!,
      type: authSource === table.name ? 'auth' : 'base',
      primaryKey: pk,
      fields,
      rules,
      expectedRows: Number.isFinite(table.rowCount) ? Number(table.rowCount) : null,
    };
  });

  for (const ext of manifest.extensions ?? []) {
    const e = ext.toLowerCase();
    if (['vector', 'pgvector'].includes(e)) warnings.push(`${ext}: vectors map to sqlite-vec`);
    else if (['uuid-ossp', 'pgcrypto'].includes(e)) warnings.push(`${ext}: UUID/crypto generation moves to the application/runtime layer`);
    else blockers.push(`Postgres extension ${ext} has no automatic InvisibleDB translation`);
  }
  if ((manifest.functions?.length ?? 0) > 0) blockers.push(`${manifest.functions!.length} database/edge function(s) require a server-side rewrite; data migration can still proceed`);
  if (manifest.auth?.usersCount && manifest.auth.passwordHashExportable === false) warnings.push('Auth password hashes are not exportable; users must reset passwords or sign in through a preserved OAuth provider');

  const penalty = Math.min(70, blockers.length * 12 + warnings.length * 2);
  return {
    manifestVersion: '1.0',
    sourceProvider: manifest.source.provider,
    compatibility: Math.max(0, 100 - penalty),
    collections,
    warnings,
    blockers,
    steps: [
      { id: 'snapshot', title: 'Destination snapshot', automatic: true, detail: 'Create a restorable InvisibleDB backup before any schema mutation.' },
      { id: 'schema', title: 'Compile and create schema', automatic: blockers.length === 0, detail: 'Create collections in two passes so relations resolve to destination collection IDs.' },
      { id: 'data', title: 'Stream data batches', automatic: true, detail: 'Import idempotent batches using deterministic PocketBase record IDs and source identity fields.' },
      { id: 'auth', title: 'Import auth identities', automatic: true, detail: 'Carry email/profile/verified state; require reset when portable password hashes are unavailable.' },
      { id: 'storage', title: 'Transfer files', automatic: true, detail: 'Stream signed HTTPS source objects into destination file fields without routing bytes through the LLM.' },
      { id: 'verify', title: 'Verify migration', automatic: true, detail: 'Require exact expected/imported counts and no failed batches before cutover.' },
      { id: 'cutover', title: 'Cut over application', automatic: blockers.length === 0, detail: 'Return endpoint/env/SDK rewrite instructions only after verification is VERIFIED.' },
    ],
  };
}
