/**
 * InvisibleDB — home page.
 * Professional rewrite: hero with live code window, stack strip,
 * explainer video, honest comparison, CTA. No emoji icons, no glow spam.
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
  openGraph: { title, description, url: '/', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
};

const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'InvisibleDB',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '6.99',
    priceCurrency: 'USD',
    description: 'Per seat per month. First month $1.',
  },
};

/* ---------- tiny inline SVG icons (no emoji) ---------- */
const Icon = {
  check: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8.5l3.2 3L13 4.5" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  minus: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 8h8" stroke="#52525b" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function CodeWindow() {
  return (
    <div className="hp-code">
      <div className="hp-code-bar">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="hp-code-file">app.ts</span>
      </div>
      <pre className="hp-code-body">{`import { InvisibleDB } from "invisibledb";

const db = new InvisibleDB({
  baseUrl: "https://demo.invisibledb.app",
  apiKey: process.env.INVISIBLEDB_KEY,
});

// auth, realtime, storage — one client
await db.auth.signIn(email, password);
db.collection("notes").subscribe(setNotes);

// vector search, built in — no Pinecone needed
const results = await db.vector.query(
  "notes_embedding",
  await db.vector.embed("quarterly roadmap")
);`}</pre>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="m-page">
      <JsonLd data={productJsonLd} />
      <style>{`
        .hp-hero { position: relative; padding: 6rem 1.5rem 4rem; text-align: center; overflow: hidden; }
        .hp-hero::before { content: ""; position: absolute; inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: radial-gradient(ellipse 70% 60% at 50% 35%, black 30%, transparent 75%);
          pointer-events: none; }
        .hp-badge { display: inline-flex; align-items: center; gap: .5rem; font-size: .8rem; color: #d4d4d8;
          border: 1px solid rgba(255,255,255,.1); border-radius: 999px; padding: .4rem 1rem; margin-bottom: 1.75rem;
          background: rgba(255,255,255,.02); position: relative; }
        .hp-badge .pulse { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; }
        .hp-hero h1 { font-size: clamp(2.6rem, 6vw, 4.5rem); line-height: 1.05; letter-spacing: -0.03em;
          margin: 0 0 1.25rem; color: #fafafa; font-weight: 700; position: relative; }
        .hp-hero h1 .hl { color: #f59e0b; }
        .hp-sub { font-size: 1.15rem; color: #a1a1aa; max-width: 620px; margin: 0 auto 2.25rem; line-height: 1.65; position: relative; }
        .hp-ctas { display: flex; gap: .9rem; justify-content: center; margin-bottom: 1rem; position: relative; }
        .hp-btn { display: inline-flex; align-items: center; gap: .5rem; background: #f59e0b; color: #0a0a0b;
          font-weight: 650; padding: .85rem 1.9rem; border-radius: 9px; text-decoration: none; font-size: 1rem; }
        .hp-btn:hover { background: #fbbf24; }
        .hp-btn.ghost { background: transparent; color: #e4e4e7; border: 1px solid rgba(255,255,255,.14); font-weight: 550; }
        .hp-btn.ghost:hover { border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.03); }
        .hp-fine { color: #71717a; font-size: .85rem; position: relative; }
        .hp-code-wrap { max-width: 720px; margin: 3.5rem auto 0; position: relative; text-align: left; }
        .hp-code { background: #101012; border: 1px solid rgba(255,255,255,.09); border-radius: 12px; overflow: hidden; }
        .hp-code-bar { display: flex; align-items: center; gap: .5rem; padding: .8rem 1.1rem; border-bottom: 1px solid rgba(255,255,255,.07); }
        .hp-code-bar .dot { width: 11px; height: 11px; border-radius: 50%; background: #2e2e33; }
        .hp-code-file { margin-left: .6rem; font-size: .8rem; color: #71717a; font-family: ui-monospace, monospace; }
        .hp-code-body { margin: 0; padding: 1.4rem 1.5rem; font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: .86rem; line-height: 1.75; color: #d4d4d8; overflow-x: auto; }
        .hp-strip { border-top: 1px solid rgba(255,255,255,.07); border-bottom: 1px solid rgba(255,255,255,.07);
          padding: 1.6rem 1.5rem; }
        .hp-strip-inner { max-width: 1100px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: .7rem 2.2rem;
          align-items: center; justify-content: center; }
        .hp-strip .lbl { font-size: .75rem; letter-spacing: .14em; text-transform: uppercase; color: #52525b; width: 100%; text-align: center; margin-bottom: .2rem; }
        .hp-stack { font-size: .95rem; color: #a1a1aa; font-weight: 550; font-family: ui-monospace, monospace; }
        .hp-sec { padding: 5.5rem 1.5rem; }
        .hp-wrap { max-width: 1100px; margin: 0 auto; }
        .hp-eyebrow { font-size: .78rem; letter-spacing: .16em; text-transform: uppercase; color: #f59e0b;
          font-weight: 650; margin-bottom: 1rem; text-align: center; }
        .hp-h2 { font-size: clamp(1.8rem, 3.6vw, 2.6rem); letter-spacing: -0.02em; color: #fafafa;
          text-align: center; margin: 0 0 1rem; font-weight: 700; }
        .hp-lede { color: #a1a1aa; text-align: center; max-width: 640px; margin: 0 auto 3rem; line-height: 1.65; font-size: 1.05rem; }
        .hp-table-wrap { overflow-x: auto; border: 1px solid rgba(255,255,255,.09); border-radius: 14px; background: #101012; }
        table.hp-table { width: 100%; border-collapse: collapse; font-size: .94rem; min-width: 640px; }
        .hp-table th, .hp-table td { padding: 1.05rem 1.4rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,.06); }
        .hp-table thead th { font-size: .78rem; letter-spacing: .1em; text-transform: uppercase; color: #71717a; font-weight: 650; }
        .hp-table thead th.us { color: #f59e0b; }
        .hp-table tbody tr:last-child td { border-bottom: none; }
        .hp-table tbody tr td:first-child { color: #a1a1aa; }
        .hp-table td.us { background: rgba(245,158,11,.05); color: #fafafa; font-weight: 550; }
        .hp-table thead th.us { background: rgba(245,158,11,.05); }
        .hp-cta { text-align: center; padding: 6rem 1.5rem; border-top: 1px solid rgba(255,255,255,.07); }
        .hp-cta h2 { font-size: clamp(2.2rem, 5vw, 3.4rem); letter-spacing: -0.025em; color: #fafafa; margin: 0 0 1rem; font-weight: 700; }
        .hp-cta p { color: #a1a1aa; margin: 0 0 2.25rem; font-size: 1.1rem; }
      `}</style>

      {/* HERO */}
      <section className="hp-hero">
        <span className="hp-badge"><span className="pulse" />ZeroAI agent OS included in every seat</span>
        <h1>
          Every backend your app needs.<br />
          <span className="hl">None of the ops.</span>
        </h1>
        <p className="hp-sub">
          InvisibleDB is the hosted backend for web and mobile apps — auth, realtime
          database, file storage, and vector search through one SDK. $6.99 a month flat.
          Your data stays yours.
        </p>
        <div className="hp-ctas">
          <a className="hp-btn" href="/signup">Get started {Icon.arrow}</a>
          <a className="hp-btn ghost" href="/pricing">See pricing</a>
        </div>
        <p className="hp-fine">First month $1 · No credit card to start</p>
        <div className="hp-code-wrap">
          <CodeWindow />
        </div>
      </section>

      {/* STACK STRIP */}
      <div className="hp-strip">
        <div className="hp-strip-inner">
          <span className="lbl">One SDK for your stack</span>
          <span className="hp-stack">JavaScript</span>
          <span className="hp-stack">TypeScript</span>
          <span className="hp-stack">Dart</span>
          <span className="hp-stack">React Native</span>
          <span className="hp-stack">Swift</span>
          <span className="hp-stack">Kotlin</span>
          <span className="hp-stack">REST</span>
        </div>
      </div>

      {/* EXPLAINER */}
      <section className="hp-sec">
        <div className="hp-wrap">
          <div className="hp-eyebrow">Watch</div>
          <h2 className="hp-h2">What is InvisibleDB?</h2>
          <p className="hp-lede">Sixty seconds: who it&rsquo;s for, what you get, and why it exists.</p>
          <DemoPlayer />
        </div>
      </section>

      {/* COMPARISON */}
      <section className="hp-sec" style={{ paddingTop: 0 }}>
        <div className="hp-wrap">
          <div className="hp-eyebrow">Why switch</div>
          <h2 className="hp-h2">An honest comparison</h2>
          <p className="hp-lede">
            PocketHost has years of trust. We win on price, on built-in AI search, on the
            ZeroAI agent OS, and on the fact that your data is never held hostage.
          </p>
          <div className="hp-table-wrap">
            <table className="hp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="us">InvisibleDB</th>
                  <th>PocketHost</th>
                  <th>Firebase</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Price</td>
                  <td className="us">$6.99/mo flat · first month $1</td>
                  <td>$9.99/mo per backend</td>
                  <td>Free, then scales to hundreds</td>
                </tr>
                <tr>
                  <td>Vector search</td>
                  <td className="us">{Icon.check} Built in</td>
                  <td>{Icon.minus} Not included</td>
                  <td>{Icon.minus} Separate service, separate bill</td>
                </tr>
                <tr>
                  <td>Your data</td>
                  <td className="us">{Icon.check} SQLite files — take them anywhere</td>
                  <td>{Icon.minus} Managed on their infra</td>
                  <td>{Icon.minus} Locked in Google Cloud</td>
                </tr>
                <tr>
                  <td>AI-agent ready</td>
                  <td className="us">{Icon.check} MCP + ZeroAI agent OS</td>
                  <td>{Icon.minus} API only</td>
                  <td>{Icon.minus} API only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="hp-cta">
        <h2>Your backend, handled.</h2>
        <p>First month is $1. Your data stays yours. What&rsquo;s stopping you?</p>
        <a className="hp-btn" href="/signup">Get started with InvisibleDB {Icon.arrow}</a>
      </section>
    </div>
  );
}
