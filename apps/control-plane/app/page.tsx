/**
 * InvisibleDB — home page.
 * Full marketing site home: hero, explainer video, honest comparison, CTA band.
 * comparison teaser, CTA band. Nav/footer come from the shared layout.
 */
import type { Metadata } from 'next';
import JsonLd from '../components/JsonLd';
import DemoPlayer from './components/DemoPlayer';

const title = 'PocketBase Hosting with an Agent OS | InvisibleDB';
const description =
  'InvisibleDB: hosted backend for web & mobile apps — auth, realtime DB, storage, vector search, and the ZeroAI agent OS. $6.99/mo flat, first month $1. Your data stays yours.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: '/', title, description, images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title, description },
};

/** Canonical citable price — SoftwareApplication + Offer (server-rendered). */
const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'InvisibleDB',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web, iOS, Android',
  url: 'https://baas.innovarel.dev',
  description,
  offers: {
    '@type': 'Offer',
    price: '6.99',
    priceCurrency: 'USD',
    description: 'Per seat per month. First month $1.',
  },
};

export default function HomePage() {
  return (
    <div className="m-page">
      <JsonLd data={productJsonLd} />
      {/* HERO */}
      <section className="m-hero">
        <span className="m-kicker-pill">Built for web &amp; mobile devs</span>
        <h1>
          Every backend your app needs. <span className="hl">None of the ops.</span>
        </h1>
        <p className="sub">
          InvisibleDB is the invisible backend: auth, realtime database, file storage, and
          built-in vector search — through one SDK for your web or mobile app. For the
          price of a coffee. And the database file is yours.
        </p>
        <div className="m-hero-ctas">
          <a className="m-btn" href="/signup">
            Get started
          </a>
          <a className="m-btn ghost" href="/pricing">
            See pricing
          </a>
        </div>
        <p className="m-fineprint">First month $1 · No credit card to start</p>
      </section>

      {/* DEMO */}
      <section className="m-section" style={{ borderTop: 'none', paddingTop: '2rem' }}>
        <div className="m-wrap">
          <DemoPlayer />
        </div>
      </section>

      {/* COMPARISON TEASER */}
      <section className="m-section" id="compare">
        <div className="m-wrap">
          <div className="m-section-head">
            <span className="kicker">Why switch</span>
            <h2>An honest comparison</h2>
            <p className="lede">
              PocketHost has years of trust. We win on price, on built-in AI search, on the
              ZeroAI agent OS, and on the fact that your data is never held hostage.
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
                  <td>AI-agent ready</td>
                  <td className="win">MCP + ZeroAI agent OS</td>
                  <td>API only</td>
                  <td>API only</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ textAlign: 'center', marginTop: '2rem' }}>
            <a className="m-btn ghost" href="/pricing">
              Full pricing breakdown
            </a>{' '}
            <a className="m-btn ghost" href="/tools/cost-comparator">
              Compare all four providers
            </a>
          </p>
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
