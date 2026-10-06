import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import JsonLd from '../components/JsonLd';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

const SITE_URL = 'https://baas.innovarel.dev';
const DEFAULT_TITLE = 'InvisibleDB — The Invisible Backend for Web & Mobile Apps';
const DEFAULT_DESCRIPTION =
  'The Firebase alternative for web & mobile apps: auth, realtime database, file storage, and built-in vector search. $6.99/mo flat, first seat $1.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'InvisibleDB',
    url: '/',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
};

/** Sitewide structured data: Organization + WebSite (server-rendered in <head>). */
const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'InvisibleDB',
      url: SITE_URL,
      logo: `${SITE_URL}/opengraph-image`,
      sameAs: ['https://innovarel.dev'],
    },
    {
      '@type': 'WebSite',
      name: 'InvisibleDB',
      url: SITE_URL,
    },
  ],
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
          <a href="/tools">Tools</a>
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
            <h2>Product</h2>
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
            <h2>Developers</h2>
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
            <h2>Free tools</h2>
            <ul>
              <li>
                <a href="/tools/firebase-bill-calculator">Firebase bill calculator</a>
              </li>
              <li>
                <a href="/tools/cost-comparator">BaaS cost comparator</a>
              </li>
              <li>
                <a href="/tools/migration-estimator">Migration estimator</a>
              </li>
              <li>
                <a href="/tools/sqlite-estimator">SQLite size estimator</a>
              </li>
              <li>
                <a href="/tools/api-playground">API playground</a>
              </li>
              <li>
                <a href="/tools/vector-playground">Vector search demo</a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Company</h2>
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
  const verificationId = process.env.GOOGLE_VERIFICATION_ID;
  return (
    <html lang="en">
      <head>
        <JsonLd data={siteJsonLd} />
        {/* Owner: set GOOGLE_VERIFICATION_ID in Vercel env after adding the property in Search Console */}
        {verificationId ? (
          <meta name="google-site-verification" content={verificationId} />
        ) : null}
      </head>
      <body className={inter.className}>
        <SiteNav />
        <main className="m-wrap">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
