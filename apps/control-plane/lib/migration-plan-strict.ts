import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { assertMigrationManifest, compileMigrationPlan, type MigrationManifest, type MigrationPlan } from './migration-manifest';

function sourcePrimaryKey(table: MigrationManifest['tables'][number]): string | null {
  if (table.primaryKey?.length === 1) return table.primaryKey[0];
  if (!table.primaryKey?.length && table.columns.some((column) => column.name === 'id')) return 'id';
  return null;
}

function recomputeCompatibility(plan: MigrationPlan) {
  const penalty = Math.min(70, plan.blockers.length * 12 + plan.warnings.length * 2);
  plan.compatibility = Math.max(0, 100 - penalty);
}

export function compileMigrationPlanStrict(manifestInput: unknown): MigrationPlan {
  assertMigrationManifest(manifestInput);
  const manifest = manifestInput as MigrationManifest;
  const plan = compileMigrationPlan(manifest);
  const blockers = new Set(plan.blockers);
  const warnings = new Set(plan.warnings);

  for (const table of manifest.tables) {
    if ((table.primaryKey?.length ?? 0) > 1) blockers.add(`${table.name}: composite primary keys require an explicit source identity transform before migration`);
    const primaryKey = sourcePrimaryKey(table);
    if (!primaryKey) blockers.add(`${table.name}: no single stable primary key was found; deterministic migration identity is unsafe`);

    for (const foreignKey of table.foreignKeys ?? []) {
      const target = manifest.tables.find((candidate) => candidate.name === foreignKey.referencesTable);
      if (!target) continue;
      const targetPrimaryKey = sourcePrimaryKey(target);
      if (!targetPrimaryKey || foreignKey.referencesColumn !== targetPrimaryKey) {
        blockers.add(`${table.name}.${foreignKey.column}: relation references ${foreignKey.referencesTable}.${foreignKey.referencesColumn}, not its single primary key; an explicit lookup transform is required`);
      }
    }
  }

  const destinationNames = new Map<string, string>();
  for (const collection of plan.collections) {
    const previous = destinationNames.get(collection.name);
    if (previous && previous !== collection.sourceTable) blockers.add(`destination collection name collision: ${previous} and ${collection.sourceTable} both map to ${collection.name}`);
    destinationNames.set(collection.name, collection.sourceTable);
  }

  if (manifest.auth?.userTable) {
    const authTable = manifest.tables.find((table) => table.name === manifest.auth?.userTable);
    if (!authTable) blockers.add(`auth user table ${manifest.auth.userTable} is not present in the manifest`);
    else if (!authTable.columns.some((column) => column.name.toLowerCase() === 'email')) blockers.add(`${authTable.name}: auth migration requires an email field for the current compatibility adapter`);
  }

  plan.blockers = [...blockers];
  plan.warnings = [...warnings];
  recomputeCompatibility(plan);
  const cutover = plan.steps.find((step) => step.id === 'cutover');
  if (cutover) cutover.automatic = plan.blockers.length === 0;
  return plan;
}

export async function createMigrationStrict(userId: string, slug: string, manifestInput: unknown) {
  assertMigrationManifest(manifestInput);
  const manifest = manifestInput as MigrationManifest;
  const plan = compileMigrationPlanStrict(manifest);
  const exactExpected = plan.collections.every((collection) => collection.expectedRows !== null);
  return prisma.migrationJob.create({
    data: {
      userId,
      slug,
      sourceProvider: manifest.source.provider,
      status: 'planned',
      manifest: manifest as unknown as Prisma.InputJsonValue,
      plan: plan as unknown as Prisma.InputJsonValue,
      progress: {
        expectedRows: exactExpected ? plan.collections.reduce((total, collection) => total + (collection.expectedRows ?? 0), 0) : null,
        exactSourceCounts: exactExpected,
        importedRows: 0,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}
