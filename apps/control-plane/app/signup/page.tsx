import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '../../lib/db';
import { createSession, hashPassword } from '../../lib/auth';
import { normalizeHostingMode } from '../../lib/hosting';

export const metadata: Metadata = {
  title: 'Get Started — First Seat $1 | InvisibleDB',
  description:
    'Create your InvisibleDB account. First month $1 — auth, realtime database, storage and vector search included.',
  alternates: { canonical: 'https://baas.innovarel.dev/signup' },
};

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const params = await searchParams;
  const requestedMode = params.mode ? normalizeHostingMode(params.mode) : 'HOSTED';

  async function signup(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');
    const hostingMode = normalizeHostingMode(formData.get('hostingMode'));
    if (!name || !email || password.length < 10) {
      redirect(`/signup?mode=${hostingMode.toLowerCase()}&error=invalid`);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) redirect(`/login?error=exists`);

    const user = await prisma.user.create({
      data: { name, email, passwordHash: hashPassword(password) },
    });
    await createSession(user.id);

    const jar = await cookies();
    jar.set('baas_hosting_mode', hostingMode, {
      path: '/', maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    redirect(hostingMode === 'HOSTED' ? '/projects/new' : '/connect');
  }

  const hosted = requestedMode === 'HOSTED';
  return (
    <div className="card" style={{ maxWidth: 520, margin: '2rem auto' }}>
      <h2>{hosted ? 'Start your hosted backend' : 'Create your account'}</h2>
      <p style={{ color: 'var(--muted)' }}>
        {hosted
          ? 'We host and manage the backend. No server or cPanel account required.'
          : 'Connect hosting you already own and run InvisibleDB there.'}
      </p>
      {params.error && <div className="callout warn">Enter a valid name, email, and password of at least 10 characters.</div>}
      <form action={signup}>
        <input type="hidden" name="hostingMode" value={requestedMode} />
        <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" required autoComplete="name" /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" /></div>
        <button className="btn" type="submit">{hosted ? 'Create account →' : 'Create account →'}</button>
      </form>
      <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '1rem' }}>
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </div>
  );
}
