import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'InvisibleDB — The invisible backend for mobile apps',
  description:
    'Auth, realtime database, file storage, and built-in vector search through one Dart SDK. $6.99/mo, first seat $1 — and the database file is yours.',
};

function SiteNav() {
  return (
    <header className="m-nav">
      <div className="m-nav-inner">
        <a className="m-logo" href="/">
          <b>Invisible</b>DB
        </a>
        <nav className="m-nav-links" aria-label="Primary">
          <a href="/#features">Product</a>
          <a href="/pricing">Pricing</a>
          <a href="/docs">Docs</a>
          <a href="/agents">Agents</a>
        </nav>
        <div className="m-nav-cta">
          <a className="m-signin" href="/signup">
            Sign in
          </a>
          <a className="m-btn small" href="/signup">
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="m-footer">
      <div className="m-wrap">
        <div className="m-footer-grid">
          <div>
            <a className="m-logo" href="/">
              <b>Invisible</b>DB
            </a>
            <p className="m-footer-tag">
              The invisible backend for mobile apps. Built by{' '}
              <a href="https://innovarel.dev">Innovarel</a>.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li>
                <a href="/#features">Features</a>
              </li>
              <li>
                <a href="/pricing">Pricing</a>
              </li>
              <li>
                <a href="/agents">For AI agents</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Developers</h4>
            <ul>
              <li>
                <a href="/docs">Documentation</a>
              </li>
              <li>
                <a href="/docs#rest">REST API</a>
              </li>
              <li>
                <a href="/tools/api-playground">API playground</a>
              </li>
              <li>
                <a href="/tools/vector-playground">Vector search demo</a>
              </li>
              <li>
                <a href="/agents#mcp">MCP server</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li>
                <a href="https://innovarel.dev">About Innovarel</a>
              </li>
              <li>
                <a href="/pricing#faq">FAQ</a>
              </li>
              <li>
                <a href="/signup">Contact</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="m-footer-bottom">
          <span>© 2026 InvisibleDB. Built by Innovarel.</span>
          <span>Privacy · Terms</span>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SiteNav />
        <main className="m-wrap">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
