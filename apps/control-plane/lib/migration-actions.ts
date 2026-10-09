import { compileMigrationPlanStrict, createMigrationStrict } from './migration-plan-strict';
import { importAuthBatch, importMigrationBatch, migrationStatus, rollbackMigration } from './migrations';
import { prepareMigrationWithIndexes } from './migration-indexes';
import { resolveMigrationBlocker } from './migration-resolutions';
import { verifyMigrationStrict } from './migration-verification';
import { importMigrationFileSafe } from './migration-file-safe';
import { cutoverMigrationSafe } from './migration-cutover';
import { queueMigrationSnapshotOnce } from './migration-snapshot';

export async function runMigrationAction(userId: string, slug: string, body: Record<string, any>) {
  switch (body.action) {
    case 'plan':
      return compileMigrationPlanStrict(body.manifest);
    case 'create':
      return createMigrationStrict(userId, slug, body.manifest);
    case 'start':
      return queueMigrationSnapshotOnce(userId, slug, String(body.migrationId || ''));
    case 'prepare':
      return prepareMigrationWithIndexes(userId, slug, String(body.migrationId || ''));
    case 'batch':
      return importMigrationBatch(userId, slug, String(body.migrationId || ''), { batchKey: String(body.batchKey || ''), collection: String(body.collection || ''), records: body.records, checksum: body.checksum });
    case 'auth_batch':
      return importAuthBatch(userId, slug, String(body.migrationId || ''), { batchKey: String(body.batchKey || ''), collection: body.collection, users: body.users });
    case 'file':
      return importMigrationFileSafe(userId, slug, String(body.migrationId || ''), { collection: String(body.collection || ''), sourceRecordId: String(body.sourceRecordId || ''), field: String(body.field || ''), filename: String(body.filename || ''), sourceUrl: String(body.sourceUrl || ''), expectedSha256: body.expectedSha256 });
    case 'resolve':
      return resolveMigrationBlocker(userId, slug, String(body.migrationId || ''), String(body.blocker || ''), String(body.evidence || ''));
    case 'verify':
      return verifyMigrationStrict(userId, slug, String(body.migrationId || ''));
    case 'cutover':
      return cutoverMigrationSafe(userId, slug, String(body.migrationId || ''));
    case 'rollback':
      return rollbackMigration(userId, slug, String(body.migrationId || ''), body.backup ? String(body.backup) : undefined);
    case 'status':
      return migrationStatus(userId, slug, body.migrationId ? String(body.migrationId) : undefined);
    default:
      throw new Error('unsupported migration action');
  }
}
