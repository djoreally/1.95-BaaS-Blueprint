-- Create ProvisionRequest table (was in schema.prisma but never migrated)
CREATE TABLE "ProvisionRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProvisionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProvisionRequest_status_idx" ON "ProvisionRequest"("status");

ALTER TABLE "ProvisionRequest" ADD CONSTRAINT "ProvisionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
