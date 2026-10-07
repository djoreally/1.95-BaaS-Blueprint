-- Baseline for the control-plane schema that existed before Prisma Migrate
-- was introduced. Existing production databases are marked as having this
-- migration applied by scripts/migrate-deploy-safe.mjs; fresh databases run it.

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HostingConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "host" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "apiTokenEncrypted" TEXT NOT NULL,
    "mainDomain" TEXT,
    "domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostingConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "fqdn" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "dbName" TEXT,
    "dbUser" TEXT,
    "status" TEXT NOT NULL DEFAULT 'provisioning',
    "steps" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "HostingConnection_userId_idx" ON "HostingConnection"("userId");
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "Project_connectionId_idx" ON "Project"("connectionId");

ALTER TABLE "HostingConnection"
ADD CONSTRAINT "HostingConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "HostingConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
