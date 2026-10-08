-- Add missing role column to User (was in schema.prisma but never migrated)
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
