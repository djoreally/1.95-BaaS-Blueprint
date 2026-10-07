import { redirect } from 'next/navigation';
import { compare } from 'bcryptjs';
import { prisma } from '../../../lib/db';
import { setSessionCookie, getSessionUser } from '../../../lib/auth';

export const metadata = { title: 'Admin login — InvisibleDB' };

export default async function AdminLogin() {
  const existing = await getSessionUser().catch(() => null);
  if (existing?.role === 'admin') redirect('/admin');

  async function login(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').toLowerCase().trim();
    const password = String(formData.get('password') ?? '');
    const user = await prisma.user.findUnique({ where: { email } });
    const ok =
      user?.role === 'admin' &&
      user.passwordHash &&
      (await compare(password, user.passwordHash));
    if (!ok) {
      redirect('/admin/login?error=1');
    }
    await setSessionCookie(user!.id);
    redirect('/admin');
  }

  return (
    <div className="card" style={{ maxWidth: 440, margin: '4rem auto' }}>
      <h2>Admin login</h2>
      <form action={login}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button type="submit" className="btn">Log in</button>
      </form>
    </div>
  );
}
