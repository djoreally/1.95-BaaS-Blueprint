import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Started — First Seat $1 | InvisibleDB',
  description:
    'Create your InvisibleDB account. First month $1, no credit card to start — auth, realtime database, storage and vector search included.',
  alternates: { canonical: 'https://baas.innovarel.dev/signup' },
};

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

/**
 * Signup — STUBBED for the MVP.
 *
 * No password, no credit card, no real auth yet: we record a display name +
 * email in a cookie so the journey (signup → connect → projects) works end
 * to end. Production replaces this with real accounts (email/OAuth).
 */
export default function Signup() {
  async function signup(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    if (!name || !email) return;
    const jar = await cookies();
    jar.set('baas_user', JSON.stringify({ name, email }), { path: '/', maxAge: 60 * 60 * 24 * 30 });
    redirect('/connect');
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: '2rem auto' }}>
      <h2>Create your account</h2>
      <p style={{ color: 'var(--muted)' }}>
        Free to start. No credit card. <em>(Auth is stubbed in this MVP — production gets real accounts.)</em>
      </p>
      <form action={signup}>
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <button className="btn" type="submit">
          Continue →
        </button>
      </form>
    </div>
  );
}
