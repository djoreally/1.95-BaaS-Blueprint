/**
 * Session auth for the control plane — dependency-free (node:crypto only).
 *
 * - Passwords: bcryptjs hashes (see package.json).
 * - Sessions: HMAC-signed tokens in an httpOnly cookie (`idb_session`).
 *   Token = base64url(userId) + "." + base64url(exp) + "." + hex(hmac).
 * - Roles: "admin" sees /admin; everyone else gets the customer journey.
 *
 * Env: SESSION_SECRET (generate: `openssl rand -hex 32`). Vercel env, never git.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from './db';

const COOKIE = 'idb_session';
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return Buffer.from(s, 'utf8');
}

function b64url(b: Buffer): string {
  return b.toString('base64url');
}

export function signSession(userId: string): string {
  const exp = String(Math.floor(Date.now() / 1000) + TTL_SECONDS);
  const payload = `${b64url(Buffer.from(userId))}.${b64url(Buffer.from(exp))}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  let token: string | undefined;
  try {
    token = (await cookies()).get(COOKIE)?.value;
  } catch {
    return null;
  }
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userB64, expB64, sig] = parts;
  const payload = `${userB64}.${expB64}`;
  const expected = createHmac('sha256', secret()).update(payload).digest('hex');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (parseInt(Buffer.from(expB64, 'base64url').toString(), 10) < Date.now() / 1000) return null;
  const userId = Buffer.from(userB64, 'base64url').toString();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u || u.role !== 'admin') {
    throw new Error('admin required');
  }
  return u;
}

export async function setSessionCookie(userId: string): Promise<void> {
  (await cookies()).set(COOKIE, signSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
