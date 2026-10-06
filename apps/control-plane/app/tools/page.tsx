/**
 * InvisibleDB — Tools index.
 *
 * Card grid for the six free tools. Server component.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

const metaTitle = 'Free Backend Tools — Calculators & Live Demos | InvisibleDB';
const metaDescription =
  'Free backend tools from InvisibleDB: Firebase bill calculator, BaaS cost comparator, migration estimator, SQLite size estimator, and live playgrounds.';

export const metadata: Metadata = {
  title: metaTitle,
  description: metaDescription,
  alternates: { canonical: '/tools' },
  openGraph: { type: 'website', url: '/tools', title: metaTitle, description: metaDescription, images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: metaTitle, description: metaDescription },
};

const TOOLS: { href: string; title: string; pitch: string; badge?: string }[] = [
  {
    href: '/tools/firebase-bill-calculator',
    title: 'Firebase Bill Calculator',
    pitch: 'See what Firebase really costs at scale.',
  },
  {
    href: '/tools/api-playground',
    title: 'API Playground',
    pitch: 'Touch a live InvisibleDB backend in your browser.',
  },
  {
    href: '/tools/vector-playground',
    title: 'Vector Search Playground',
    pitch: 'Semantic search, no Pinecone required.',
  },
  {
    href: '/tools/cost-comparator',
    title: 'Cost Comparator',
    pitch: 'Firebase vs Supabase vs PocketHost vs InvisibleDB.',
  },
  {
    href: '/tools/migration-estimator',
    title: 'Migration Estimator',
    pitch: 'Leaving Firebase? Get your migration plan.',
    badge: 'New',
  },
  {
    href: '/tools/sqlite-estimator',
    title: 'SQLite Size Estimator',
    pitch: 'Your entire database fits in one file.',
    badge: 'New',
  },
];

export default function ToolsIndexPage() {
  return (
    <div className="m-page">
      {/* HERO */}
      <section className="m-hero">
        <span className="kicker-pill">Free tools</span>
        <h1>
          Do the math. <span className="hl">Touch the product.</span>
        </h1>
        <p className="sub">
          Six tools that answer the questions Firebase hopes you never ask:
          what does it really cost, how hard is it to leave, and how small is
          your data really?
        </p>
      </section>

      {/* GRID */}
      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap">
          <div className="m-section-head">
            <h2>The toolbox</h2>
            <p className="lede">Six tools, zero signup. Pick one and start calculating.</p>
          </div>
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

      {/* DEVELOPER TOOLS */}
      <section className="m-section">
        <div className="m-wrap">
          <div className="m-section-head">
            <h2>Developer tools</h2>
            <p className="lede">
              Eight mini utilities that run 100% in your browser — secret keys,
              hashes, UUIDs, JWT decoding, and more. Nothing ever leaves the page.
            </p>
          </div>
          <div className="m-grid">
            {[
              { href: '/tools/dev/secret-key-generator', title: 'Secret Key Generator', pitch: 'Cryptographically secure API keys in every format.' },
              { href: '/tools/dev/hash-generator', title: 'Hash Generator', pitch: 'SHA-256, SHA-384, SHA-512 digests.' },
              { href: '/tools/dev/uuid-generator', title: 'UUID Generator', pitch: 'Bulk UUID v4, up to 100 at once.' },
              { href: '/tools/dev/jwt-decoder', title: 'JWT Decoder', pitch: 'Headers, claims, expiry — alg:none warnings.' },
              { href: '/tools/dev/json-formatter', title: 'JSON Formatter', pitch: 'Format, minify, validate with error locations.' },
              { href: '/tools/dev/base64', title: 'Base64 Encoder / Decoder', pitch: 'Unicode-safe, both directions.' },
              { href: '/tools/dev/url-encoder', title: 'URL Encoder / Decoder', pitch: 'Percent-encoding for URLs and components.' },
              { href: '/tools/dev/timestamp-converter', title: 'Timestamp Converter', pitch: 'Unix, ISO, and human time.' },
            ].map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="m-card"
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <h3>{t.title}</h3>
                <p>{t.pitch}</p>
                <p style={{ marginTop: '1rem', color: 'var(--amber)', fontWeight: 700, fontSize: '0.92rem' }}>
                  Open tool →
                </p>
              </Link>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link href="/tools/dev" style={{ color: 'var(--amber)', fontWeight: 700 }}>
              Browse all developer tools →
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="m-cta-band" style={{ borderTop: '1px solid var(--line-soft)' }}>
        <h2>
          Done estimating? <span className="hl">Start building.</span>
        </h2>
        <p>$6.99/mo per seat, first month $1. The database file is yours.</p>
        <a className="m-btn" href="/signup">
          Get started
        </a>
      </section>
    </div>
  );
}
