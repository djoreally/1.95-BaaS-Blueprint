import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const BASELINE = '20261006_baseline_control_plane';
const LEGACY_TABLES = ['User', 'HostingConnection', 'Project'];

function runPrisma(args) {
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('User', 'HostingConnection', 'Project', '_prisma_migrations')
  `);

  const tables = new Set(rows.map((row) => row.table_name));
  const hasMigrationHistory = tables.has('_prisma_migrations');
  const legacyPresent = LEGACY_TABLES.filter((name) => tables.has(name));

  if (!hasMigrationHistory && legacyPresent.length > 0) {
    if (legacyPresent.length !== LEGACY_TABLES.length) {
      throw new Error(
        `Refusing to baseline a partial legacy schema. Found: ${legacyPresent.join(', ') || 'none'}`,
      );
    }

    console.log(`Existing control-plane schema detected; baselining ${BASELINE} without recreating tables.`);
    await prisma.$disconnect();
    runPrisma(['migrate', 'resolve', '--applied', BASELINE]);
    runPrisma(['migrate', 'deploy']);
    process.exit(0);
  }

  await prisma.$disconnect();
  runPrisma(['migrate', 'deploy']);
} catch (error) {
  await prisma.$disconnect().catch(() => {});
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
