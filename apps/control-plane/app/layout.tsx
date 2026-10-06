import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InvisibleDB — The invisible backend for mobile apps',
  description:
    'Auth, realtime database, file storage, and built-in vector search through one Dart SDK. $6.99/mo, first seat $1 — and the database file is yours.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="wrap">
            <a className="brand" href="/">
              1.95 BaaS <span>control plane</span>
            </a>
            <nav>
              <a href="/projects">Projects</a>
              <a href="/projects/new">New project</a>
              <a href="/connect">Connect hosting</a>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
