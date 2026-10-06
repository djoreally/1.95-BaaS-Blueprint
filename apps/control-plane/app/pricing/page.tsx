/**
 * InvisibleDB — pricing page.
 */
import type { Metadata } from 'next';
import JsonLd from '../../components/JsonLd';

const title = 'Backend Pricing — $6.99/mo, First Seat $1 | InvisibleDB';
const description =
  'InvisibleDB pricing: one flat $6.99/mo per seat, first month $1. Auth, realtime DB, storage, vector search, ZeroAI agent OS. No meters, no surprise bills.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/pricing' },
  openGraph: { type: 'website', url: '/pricing', title, description, images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title, description },
};

/** Canonical citable price — SoftwareApplication + Offer (server-rendered). */
const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'InvisibleDB',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web, iOS, Android',
  url: 'https://baas.innovarel.dev/pricing',
  description,
  offers: {
    '@type': 'Offer',
    price: '6.99',
    priceCurrency: 'USD',
    description: 'Per seat per month. First month $1.',
  },
};

/**
 * FAQ structured data for machine readability.
 * (Google retired FAQ rich results in May 2026 — this is index-signal only.)
 */
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What do I actually get?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A complete hosted backend per seat: user auth, a realtime database, file storage, a full admin UI, built-in vector search, and the ZeroAI agent OS — all reachable through one Dart SDK (plus JavaScript and REST).',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I leave with my data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Yes. Your data lives in plain SQLite files. Export them any time, move them anywhere, run them yourself — we'd rather keep you with a great product than with lock-in.",
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need DevOps experience?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Sign up, copy your API keys, paste the snippet. There are no servers to configure, no containers to babysit, no YAML.',
      },
    },
    {
      '@type': 'Question',
      name: 'What about scale?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'InvisibleDB is built for indie apps growing into real businesses — thousands to hundreds of thousands of users, not billions. If you outgrow it, your SQLite files come with you.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is the free tier really free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Yes. Run InvisibleDB on your own hosting while you develop — full features, no card, no trial clock. Hosted seats are $6.99/mo (first month $1) when you're ready.",
      },
    },
    {
      '@type': 'Question',
      name: "What's the ZeroAI agent OS?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The deterministic layer around AI models that ships with every seat: persistent agent memory, a tamper-evident audit ledger, a permission broker, and lifecycle gates.',
      },
    },
  ],
};

export default function PricingPage() {
  return (
    <div className="m-page">
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqJsonLd} />
      {/* HERO */}
      <section className="m-hero">
        <span className="kicker">Pricing</span>
        <h1>
          One price. <span className="hl">No meters.</span>
        </h1>
        <p className="sub">
          Stop doing backend math. This is the whole pricing page — one seat, one flat
          price, everything included.
        </p>
      </section>

      {/* PRICE CARD */}
      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap">
          <div className="m-pricing-card">
            <div className="tier">InvisibleDB Seat</div>
            <div className="amount">
              $6.99<span>/mo</span>
            </div>
            <div>
              <span className="first">First month $1</span>
            </div>
            <ul className="m-checklist">
              <li>Full backend: auth, realtime database, file storage, admin UI</li>
              <li>Vector search built in — no Pinecone needed</li>
              <li>ZeroAI agent OS: agent memory, audit ledger, permission gates</li>
              <li>MCP server, REST API, and CLI for AI-assisted development</li>
              <li>Your data as SQLite files — take them anywhere</li>
              <li>No bandwidth meters, no per-seat premiums, no surprise bills</li>
            </ul>
            <a className="m-btn" href="/signup">
              Get started
            </a>
          </div>

          <div style={{ maxWidth: '48rem', margin: '3rem auto 0' }}>
            <h2 className="h3" style={{ textAlign: 'center', marginBottom: '1rem' }}>Just want to tinker?</h2>
            <p className="lede" style={{ textAlign: 'center', margin: '0 auto' }}>
              The <strong style={{ color: 'var(--ink)' }}>free dev tier</strong> lets you run
              InvisibleDB on your own hosting while you build — full features, no card, no
              trial clock. It&apos;s the same backend, on hardware you already pay for.
              Upgrade to a hosted seat when you&apos;re ready to stop thinking about servers.
            </p>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="m-section" id="compare">
        <div className="m-wrap">
          <div className="m-section-head">
            <span className="kicker">The real trade</span>
            <h2>An honest comparison</h2>
            <p className="lede">
              We&apos;re not the right choice for everyone. Here&apos;s where each option
              actually wins.
            </p>
          </div>
          <div className="m-table-wrap">
            <table className="m-table">
              <thead>
                <tr>
                  <th></th>
                  <th>InvisibleDB</th>
                  <th>PocketHost</th>
                  <th>Firebase</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Price</td>
                  <td className="win">$6.99/mo flat · first month $1</td>
                  <td>$9.99/mo per backend</td>
                  <td>Free, then scales to hundreds</td>
                </tr>
                <tr>
                  <td>Vector search</td>
                  <td className="win">Built in</td>
                  <td>Not included</td>
                  <td>Separate service, separate bill</td>
                </tr>
                <tr>
                  <td>Your data</td>
                  <td className="win">SQLite files — take them anywhere</td>
                  <td>Managed on their infra</td>
                  <td>Locked in Google Cloud</td>
                </tr>
                <tr>
                  <td>DevOps required</td>
                  <td className="win">Zero</td>
                  <td>Zero</td>
                  <td>Zero, until the bill arrives</td>
                </tr>
                <tr>
                  <td>AI-agent ready</td>
                  <td className="win">MCP + ZeroAI agent OS</td>
                  <td>API only</td>
                  <td>API only</td>
                </tr>
                <tr>
                  <td>Free tier</td>
                  <td className="win">Yes — dev tier</td>
                  <td>No</td>
                  <td>Yes — Spark plan</td>
                </tr>
                <tr>
                  <td>Track record</td>
                  <td>New — we earn it daily</td>
                  <td className="win">Trusted since 2021</td>
                  <td className="win">Google-scale, since 2011</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="lede" style={{ textAlign: 'center', margin: '2rem auto 0' }}>
            PocketHost has years of trust. We win on price, on built-in AI search, on the
            ZeroAI agent OS, and on the fact that your data is never held hostage.
          </p>
          <p className="lede" style={{ textAlign: 'center', margin: '1.5rem auto 0' }}>
            Run your own numbers: the free{' '}
            <a href="/tools/firebase-bill-calculator">Firebase bill calculator</a>{' '}
            estimates your Firebase costs from public list prices, and the{' '}
            <a href="/tools/cost-comparator">cost comparator</a> puts all four providers
            on one table.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="m-section" id="faq">
        <div className="m-wrap">
          <div className="m-section-head">
            <span className="kicker">FAQ</span>
            <h2>Questions, answered straight</h2>
            <p className="lede">No marketing fog.</p>
          </div>
          <div className="m-faq">
            <details>
              <summary>What do I actually get?</summary>
              <p>
                A complete hosted backend per seat: user auth, a realtime database, file
                storage, a full admin UI, built-in vector search, and the ZeroAI agent OS —
                all reachable through one Dart SDK (plus JavaScript and REST). You write app
                code; the backend just exists.
              </p>
            </details>
            <details>
              <summary>Can I leave with my data?</summary>
              <p>
                Yes — that&apos;s the point. Your data lives in plain SQLite files. Export
                them any time, move them anywhere, run them yourself. We&apos;d rather keep
                you with a great product than with lock-in.
              </p>
            </details>
            <details>
              <summary>Do I need DevOps experience?</summary>
              <p>
                No. Sign up, copy your API keys, paste the snippet. There are no servers to
                configure, no containers to babysit, no YAML. If you&apos;ve ever added a
                package to pubspec.yaml, you already know enough.
              </p>
            </details>
            <details>
              <summary>What about scale?</summary>
              <p>
                Honest answer: InvisibleDB is built for indie apps growing into real
                businesses — thousands to hundreds of thousands of users, not billions. If
                you outgrow us, your SQLite files come with you. We&apos;d rather tell you
                the ceiling than discover it together at 3am.
              </p>
            </details>
            <details>
              <summary>Is the free tier really free?</summary>
              <p>
                Yes. Run InvisibleDB on your own hosting while you develop — full features,
                no card, no trial clock. When you want us to host it and stop thinking about
                servers, that&apos;s $6.99/mo (first month $1).
              </p>
            </details>
            <details>
              <summary>What&apos;s the ZeroAI agent OS?</summary>
              <p>
                It&apos;s the deterministic layer around AI models that ships with every
                seat: persistent agent memory, a tamper-evident audit ledger, a permission
                broker, and lifecycle gates. Your agents stop hallucinating state because
                state lives outside inference. <a href="/agents">Read the full breakdown →</a>
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="m-cta-band">
        <h2>Your backend, handled.</h2>
        <p>First month is $1. Your data stays yours. What&apos;s stopping you?</p>
        <a className="m-btn" href="/signup">
          Get started with InvisibleDB
        </a>
      </section>
    </div>
  );
}
