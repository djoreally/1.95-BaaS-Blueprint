import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '1.95 BaaS — Control Plane',
  description: 'Coolify-style dashboard for $2 shared hosting',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #eee' }}>
          <strong>1.95 BaaS</strong> <span style={{ color: '#666' }}>control plane</span>
        </header>
        <main style={{ padding: '2rem' }}>{children}</main>
      </body>
    </html>
  );
}
