import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from './db';

const SESSION_COOKIE = 'baas_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = { uid: string; exp: number };

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.CONTROL_PLANE_ENCRYPTION_KEY;
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function decodeSession(raw: string | undefined): SessionPayload | null {
  if (!raw) return null;
  const [body, signature] = raw.split('.');
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.uid || !payload.exp || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, encoded: string | null): boolean {
  if (!encoded) return false;
  const [scheme, salt, expectedHex] = encoded.split('$');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(
    SESSION_COOKIE,
    encodeSession({ uid: userId, exp: Date.now() + SESSION_TTL_SECONDS * 1000 }),
    {
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  );
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true });
  jar.set('baas_hosting_mode', '', { path: '/', maxAge: 0, httpOnly: true });
}

export async function currentUser() {
  const jar = await cookies();
  const payload = decodeSession(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.uid } });
}
