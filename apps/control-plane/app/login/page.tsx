import { redirect } from 'next/navigation';
import { prisma } from '../../lib/db';
import { createSession, verifyPassword } from '../../lib/auth';

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  async function login(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) redirect('/login?error=invalid');
    await createSession(user.id);
    redirect('/projects');
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: '2rem auto' }}>
      <h2>Sign in</h2>
      {params.error === 'exists' && <div className="callout">That email already has an account. Sign in instead.</div>}
      {params.error === 'invalid' && <div className="callout warn">Email or password is incorrect.</div>}
      <form action={login}>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" /></div>
        <button className="btn" type="submit">Sign in →</button>
      </form>
      <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '1rem' }}>Need an account? <a href="/signup">Create one</a></p>
    </div>
  );
}
