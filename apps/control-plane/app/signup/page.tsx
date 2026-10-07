import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Started — First Seat $1 | InvisibleDB',
  description:
    'Create your InvisibleDB account. First month $1 — auth, realtime database, storage and vector search included.',
  alternates: { canonical: 'https://baas.innovarel.dev/signup' },
};

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { normalizeHostingMode } from '../../lib/hosting';

/**
 * Signup — account auth is still MVP-stubbed, but hosting intent is real.
 *
 * HOSTED customers skip cPanel entirely and go straight to project creation.
 * BYOH customers keep the existing connect-hosting flow.
 */
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const requestedMode = normalizeHostingMode(params.mode);

  async function signup(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const hostingMode = normalizeHostingMode(formData.get('hostingMode'));
    if (!name || !email) return;

    const jar = await cookies();
    jar.set('baas_user', JSON.stringify({ name, email }), {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    jar.set('baas_hosting_mode', hostingMode, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: 'lax',
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
      <form action={signup}>
        <input type="hidden" name="hostingMode" value={requestedMode} />
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <button className="btn" type="submit">
          {hosted ? 'Continue to your project →' : 'Continue →'}
        </button>
      </form>
      <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '1rem' }}>
        Account authentication and billing are being upgraded from the MVP stub before public paid launch.
      </p>
    </div>
  );
}
