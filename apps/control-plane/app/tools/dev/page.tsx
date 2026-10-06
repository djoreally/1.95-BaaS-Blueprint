/**
 * InvisibleDB — Developer tools index.
 *
 * Eight client-side mini tools. Server component.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

const metaTitle = 'Free Developer Tools — Secret Keys, Hashes, UUIDs & More | InvisibleDB';
const metaDescription =
  'Free developer tools from InvisibleDB: cryptographically secure secret key generator, SHA-256/384/512 hashing, bulk UUIDs, Base64, JWT decoder, JSON formatter, timestamp converter. 100% in your browser.';

export const metadata: Metadata = {
  title: metaTitle,
  description: metaDescription,
  alternates: { canonical: '/tools/dev' },
  openGraph: { type: 'website', url: '/tools/dev', title: metaTitle, description: metaDescription, images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: metaTitle, description: metaDescription },
};

const TOOLS: { href: string; title: string; pitch: string; badge?: string }[] = [
  {
    href: '/tools/dev/secret-key-generator',
    title: 'Secret Key Generator',
    pitch: 'Cryptographically secure API keys in hex, base64, or alphanumeric.',
    badge: 'Popular',
  },
  {
    href: '/tools/dev/hash-generator',
    title: 'Hash Generator',
    pitch: 'SHA-256, SHA-384, and SHA-512 digests of any text.',
  },
  {
    href: '/tools/dev/uuid-generator',
    title: 'UUID Generator',
    pitch: 'Bulk UUID v4 — up to 100 at a time.',
  },
  {
    href: '/tools/dev/jwt-decoder',
    title: 'JWT Decoder',
    pitch: 'Inspect headers, claims, and expiry. Warns on alg: none.',
  },
  {
    href: '/tools/dev/json-formatter',
    title: 'JSON Formatter',
    pitch: 'Format, minify, and validate with precise error locations.',
  },
  {
    href: '/tools/dev/base64',
    title: 'Base64 Encoder / Decoder',
    pitch: 'Unicode-safe Base64 in both directions.',
  },
  {
    href: '/tools/dev/url-encoder',
    title: 'URL Encoder / Decoder',
    pitch: 'Percent-encoding for URLs and components.',
  },
  {
    href: '/tools/dev/timestamp-converter',
    title: 'Timestamp Converter',
    pitch: 'Unix seconds, milliseconds, ISO, and human time.',
  },
];

export default function DevToolsIndexPage() {
  return (
    <div className="m-page">
      <section className="m-hero">
        <span className="kicker-pill">Developer tools</span>
        <h1>
          Small tools. <span className="hl">Zero trust required.</span>
        </h1>
        <p className="sub">
          Eight free utilities that run entirely in your browser. Generate a secret
          key, hash a string, decode a JWT — nothing ever leaves this page.
        </p>
      </section>

      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap">
          <div className="m-grid">
            {TOOLS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="m-card"
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <h3>
                  {t.title}
                  {t.badge && (
                    <span
                      className="badge up"
                      style={{ marginLeft: '0.6rem', verticalAlign: 'middle' }}
                    >
                      {t.badge}
                    </span>
                  )}
                </h3>
                <p>{t.pitch}</p>
                <p style={{ marginTop: '1rem', color: 'var(--amber)', fontWeight: 700, fontSize: '0.92rem' }}>
                  Open tool →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="m-cta-band" style={{ borderTop: '1px solid var(--line-soft)' }}>
        <h2>
          Need a backend too? <span className="hl">$6.99/mo.</span>
        </h2>
        <p>Auth, realtime database, file storage, vector search, and an agent OS. First month $1.</p>
        <a className="m-btn" href="/signup">
          Get started
        </a>
      </section>
    </div>
  );
}
