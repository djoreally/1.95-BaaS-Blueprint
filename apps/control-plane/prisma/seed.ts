/**
 * Seed the super admin. Run once:
 *   ADMIN_EMAIL=you@x.com ADMIN_PASSWORD=... npx tsx prisma/seed.ts
 * (or via `prisma db seed` once wired). Never commit the password.
 * Uses the same scrypt hash as lib/auth.ts — no bcrypt dependency.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password || password.length < 12) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 12 chars).');
  }
  const passwordHash = hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'admin', name: 'Tyreese' },
    create: { email, name: 'Tyreese', passwordHash, role: 'admin' },
  });
  console.log(`super admin ready: ${user.email} (${user.role})`);
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
