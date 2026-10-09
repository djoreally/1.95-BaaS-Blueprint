CREATE TABLE IF NOT EXISTS "ControlPlaneApiKey" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ControlPlaneApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ControlPlaneApiKey_keyHash_key" ON "ControlPlaneApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "ControlPlaneApiKey_userId_createdAt_idx" ON "ControlPlaneApiKey"("userId", "createdAt");
ALTER TABLE "ControlPlaneApiKey" ADD CONSTRAINT "ControlPlaneApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MigrationJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "manifest" JSONB NOT NULL,
  "plan" JSONB NOT NULL,
  "progress" JSONB,
  "verification" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MigrationJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MigrationJob_userId_slug_createdAt_idx" ON "MigrationJob"("userId", "slug", "createdAt");
CREATE INDEX IF NOT EXISTS "MigrationJob_status_updatedAt_idx" ON "MigrationJob"("status", "updatedAt");
ALTER TABLE "MigrationJob" ADD CONSTRAINT "MigrationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MigrationBatch" (
  "id" TEXT NOT NULL,
  "migrationId" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL,
  "collection" TEXT NOT NULL,
  "checksum" TEXT,
  "received" INTEGER NOT NULL DEFAULT 0,
  "imported" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MigrationBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MigrationBatch_migrationId_batchKey_key" ON "MigrationBatch"("migrationId", "batchKey");
CREATE INDEX IF NOT EXISTS "MigrationBatch_migrationId_collection_idx" ON "MigrationBatch"("migrationId", "collection");
ALTER TABLE "MigrationBatch" ADD CONSTRAINT "MigrationBatch_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "MigrationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
