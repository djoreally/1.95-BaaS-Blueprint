-- Runtime command queue + latest per-instance state.
-- Additive only; no existing tables/columns are altered.

CREATE TABLE IF NOT EXISTS "RuntimeCommand" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "result" JSONB,
  "secretResultEncrypted" TEXT,
  "claimedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RuntimeCommand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InstanceState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstanceState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RuntimeCommand_status_createdAt_idx"
  ON "RuntimeCommand"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "RuntimeCommand_userId_slug_createdAt_idx"
  ON "RuntimeCommand"("userId", "slug", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "InstanceState_userId_slug_key"
  ON "InstanceState"("userId", "slug");
CREATE INDEX IF NOT EXISTS "InstanceState_slug_idx"
  ON "InstanceState"("slug");

DO $$ BEGIN
  ALTER TABLE "RuntimeCommand"
    ADD CONSTRAINT "RuntimeCommand_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstanceState"
    ADD CONSTRAINT "InstanceState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
