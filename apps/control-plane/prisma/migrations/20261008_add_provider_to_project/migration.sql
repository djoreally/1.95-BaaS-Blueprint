-- Add provider field to Project for unified instance model (vps | cpanel)
ALTER TABLE "Project" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'vps';

-- Make port nullable (VPS instances don't use port allocation)
ALTER TABLE "Project" ALTER COLUMN "port" DROP NOT NULL;
