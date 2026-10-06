/**
 * InvisibleDB — public marketing landing page.
 *
 * Standalone dark SaaS marketing page. Renders its own nav/footer and hides
 * the dashboard chrome from layout.tsx (scoped CSS only — no other page is
 * affected). Server component, no client JS, no new dependencies.
 */

const css = `
.site-header { display: none; }
.idb { background: #0a0a0b; color: #f4f4f5; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.6; margin: -2.5rem -1.5rem -4rem; }
.idb a { color: inherit; }
.idb-nav { position: sticky; top: 0; z-index: 10; background: #0a0a0b; border-bottom: 1px solid #232327; }
.idb-nav-inner { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem; height: 64px; display: flex; align-items: center; gap: 2rem; }
.idb-logo { font-weight: 800; font-size: 1.15rem; letter-spacing: -0.01em; text-decoration: none; }
.idb-logo b { color: #f59e0b; }
.idb-nav-links { display: flex; gap: 1.5rem; margin-left: 1rem; }
.idb-nav-links a { color: #a1a1aa; text-decoration: none; font-size: 0.92rem; }
.idb-nav-links a:hover { color: #f4f4f5; }
.idb-nav-cta { margin-left: auto; display: flex; gap: 0.75rem; align-items: center; }
.idb-signin { color: #a1a1aa; text-decoration: none; font-size: 0.92rem; }
.idb-signin:hover { color: #f4f4f5; }
.idb-btn { display: inline-block; background: #f59e0b; color: #0a0a0b; font-weight: 700; border-radius: 10px; padding: 0.7rem 1.5rem; text-decoration: none; font-size: 0.98rem; border: none; cursor: pointer; }
.idb-btn:hover { background: #d97706; }
.idb-btn.ghost { background: transparent; color: #f4f4f5; border: 1px solid #3f3f46; }
.idb-btn.ghost:hover { border-color: #71717a; background: #131316; }
.idb-btn.small { padding: 0.5rem 1.1rem; font-size: 0.9rem; }
.idb-wrap { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem; }
.idb-hero { text-align: center; padding: 6rem 1.5rem 4.5rem; max-width: 860px; margin: 0 auto; }
.idb-kicker { display: inline-block; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #f59e0b; border: 1px solid rgba(245,158,11,0.28); background: #0a0a0b; border-radius: 999px; padding: 0.35rem 1rem; margin-bottom: 1.5rem; }
.idb-hero h1 { font-size: 3.4rem; line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 1.25rem; font-weight: 800; }
.idb-hero h1 .hl { color: #f59e0b; }
.idb-hero p.sub { font-size: 1.25rem; color: #a1a1aa; max-width: 660px; margin: 0 auto 2.25rem; }
.idb-hero-ctas { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
.idb-fineprint { font-size: 0.88rem; color: #71717a; }
.idb-section { padding: 4.5rem 0; border-top: 1px solid #1c1c1f; }
.idb-section h2 { font-size: 2.1rem; letter-spacing: -0.02em; margin: 0 0 0.75rem; font-weight: 800; text-align: center; }
.idb-section .lede { color: #a1a1aa; font-size: 1.12rem; max-width: 680px; margin: 0 auto 3rem; text-align: center; }
.idb-bill { background: #131316; border: 1px solid #232327; border-radius: 16px; padding: 2.5rem; max-width: 760px; margin: 0 auto; }
.idb-bill .row { display: flex; justify-content: space-between; align-items: baseline; padding: 0.9rem 0; border-bottom: 1px solid #232327; }
.idb-bill .row:last-child { border-bottom: none; }
.idb-bill .row .label { color: #a1a1aa; }
.idb-bill .row .price { font-weight: 800; font-size: 1.3rem; }
.idb-bill .row .price.bad { color: #f87171; }
.idb-bill .row .price.good { color: #f59e0b; }
.idb-bill .note { margin-top: 1.25rem; font-size: 0.92rem; color: #71717a; }
.idb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
.idb-card { background: #131316; border: 1px solid #232327; border-radius: 14px; padding: 1.75rem; }
.idb-card .icon { font-size: 1.6rem; margin-bottom: 0.75rem; }
.idb-card h3 { margin: 0 0 0.5rem; font-size: 1.08rem; }
.idb-card p { margin: 0; color: #a1a1aa; font-size: 0.95rem; }
.idb-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
.idb-step { background: #131316; border: 1px solid #232327; border-radius: 14px; padding: 1.75rem; }
.idb-step .num { display: inline-flex; align-items: center; justify-content: center; width: 2.2rem; height: 2.2rem; border-radius: 999px; background: #f59e0b; color: #0a0a0b; font-weight: 800; margin-bottom: 1rem; }
.idb-step h3 { margin: 0 0 0.5rem; font-size: 1.08rem; }
.idb-step p { margin: 0; color: #a1a1aa; font-size: 0.95rem; }
.idb-pricing-card { background: #131316; border: 2px solid #f59e0b; border-radius: 18px; padding: 3rem; max-width: 560px; margin: 0 auto; text-align: center; }
.idb-pricing-card .tier { font-size: 0.85rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #f59e0b; margin-bottom: 1rem; }
.idb-pricing-card .amount { font-size: 3.5rem; font-weight: 800; letter-spacing: -0.03em; }
.idb-pricing-card .amount span { font-size: 1.1rem; font-weight: 400; color: #a1a1aa; }
.idb-pricing-card .first { display: inline-block; margin: 0.75rem 0 1.5rem; background: #0a0a0b; border: 1px solid rgba(245,158,11,0.28); color: #f59e0b; font-weight: 700; border-radius: 999px; padding: 0.4rem 1.1rem; font-size: 0.92rem; }
.idb-pricing-card ul { list-style: none; padding: 0; margin: 0 0 2rem; text-align: left; }
.idb-pricing-card li { padding: 0.55rem 0; border-bottom: 1px solid #232327; color: #d4d4d8; font-size: 0.97rem; }
.idb-pricing-card li:last-child { border-bottom: none; }
.idb-pricing-card li::before { content: "\\2713  "; color: #f59e0b; font-weight: 700; }
.idb-devtier { text-align: center; margin-top: 2rem; color: #a1a1aa; font-size: 0.97rem; }
.idb-devtier b { color: #f4f4f5; }
.idb-table-wrap { overflow-x: auto; max-width: 900px; margin: 0 auto; }
.idb-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
.idb-table th, .idb-table td { text-align: left; padding: 0.9rem 1rem; border-bottom: 1px solid #232327; }
.idb-table th { color: #a1a1aa; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
.idb-table td:first-child { color: #a1a1aa; }
.idb-table .win { color: #f59e0b; font-weight: 700; }
.idb-honest { max-width: 760px; margin: 2rem auto 0; color: #71717a; font-size: 0.92rem; text-align: center; }
.idb-faq { max-width: 760px; margin: 0 auto; }
.idb-faq details { background: #131316; border: 1px solid #232327; border-radius: 12px; margin-bottom: 0.75rem; padding: 1.1rem 1.4rem; }
.idb-faq summary { font-weight: 700; cursor: pointer; font-size: 1.02rem; list-style: none; }
.idb-faq summary::-webkit-details-marker { display: none; }
.idb-faq summary::after { content: "+"; float: right; color: #f59e0b; font-size: 1.3rem; line-height: 1; }
.idb-faq details[open] summary::after { content: "\\2013"; }
.idb-faq details p { color: #a1a1aa; margin: 0.75rem 0 0.25rem; font-size: 0.96rem; }
.idb-cta-band { text-align: center; padding: 5rem 1.5rem; }
.idb-cta-band h2 { font-size: 2.4rem; letter-spacing: -0.02em; margin: 0 0 1rem; }
.idb-cta-band p { color: #a1a1aa; margin: 0 0 2rem; font-size: 1.1rem; }
.idb-footer { border-top: 1px solid #1c1c1f; padding: 2.5rem 0; }
.idb-footer-inner { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
.idb-footer .tag { color: #71717a; font-size: 0.9rem; }
.idb-footer nav { display: flex; gap: 1.5rem; }
.idb-footer nav a { color: #a1a1aa; text-decoration: none; font-size: 0.9rem; }
.idb-footer nav a:hover { color: #f4f4f5; }
@media (max-width: 760px) {
  .idb { margin: -2.5rem -1rem -4rem; }
  .idb-hero { padding: 4rem 1rem 3rem; }
  .idb-hero h1 { font-size: 2.2rem; }
  .idb-hero p.sub { font-size: 1.05rem; }
  .idb-grid, .idb-steps { grid-template-columns: 1fr; }
  .idb-nav-links { display: none; }
  .idb-section h2 { font-size: 1.6rem; }
  .idb-pricing-card { padding: 2rem 1.5rem; }
  .idb-bill { padding: 1.5rem; }
}
`;

export default function InvisibleDBLanding() {
  return (
    <div className="idb">
      <style>{css}</style>

      {/* NAV */}
      <header className="idb-nav">
        <div className="idb-nav-inner">
          <a className="idb-logo" href="/">
            <b>Invisible</b>DB
          </a>
          <nav className="idb-nav-links">
            <a href="#pricing">Pricing</a>
            <a href="#faq">Docs</a>
          </nav>
          <div className="idb-nav-cta">
            <a className="idb-signin" href="/signup">
              Sign in
            </a>
            <a className="idb-btn small" href="/signup">
              Get started
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="idb-hero">
        <span className="idb-kicker">Built for Flutter &amp; indie mobile devs</span>
        <h1>
          Every backend Firebase gives you. <span className="hl">None of the bill.</span>
        </h1>
        <p className="sub">
          InvisibleDB is the invisible backend: auth, realtime database, file storage, and
          built-in vector search — through one Dart SDK. For the price of a coffee. And the
          database file is yours.
        </p>
        <div className="idb-hero-ctas">
          <a className="idb-btn" href="/signup">
            Get started
          </a>
          <a className="idb-btn ghost" href="#pricing">
            See pricing
          </a>
        </div>
        <p className="idb-fineprint">First seat $1 · No credit card to start</p>
      </section>

      {/* PROBLEM */}
      <section className="idb-section">
        <div className="idb-wrap">
          <h2>The Firebase trap</h2>
          <p className="lede">
            You start on the free tier. Then your app gets traction — and your backend bill goes
            from $0 to $500 overnight. Metered everything, per-seat premiums, and your data locked
            inside someone else&apos;s cloud.
          </p>
          <div className="idb-bill">
            <div className="row">
              <span className="label">Your app, month one</span>
              <span className="price good">$0</span>
            </div>
            <div className="row">
              <span className="label">Your app, after traction</span>
              <span className="price bad">$500+</span>
            </div>
            <div className="row">
              <span className="label">Moving your data somewhere cheaper</span>
              <span className="price bad">Good luck</span>
            </div>
            <p className="note">
              InvisibleDB charges one flat price per seat. No meters, no surprise bills, and your
              data lives in SQLite files you can take anywhere — including away from us.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="idb-section" id="features">
        <div className="idb-wrap">
          <h2>Everything your app needs. Nothing it doesn&apos;t.</h2>
          <p className="lede">One backend, one SDK, zero servers to babysit.</p>
          <div className="idb-grid">
            <div className="idb-card">
              <div className="icon">🔐</div>
              <h3>Auth</h3>
              <p>Email, OAuth, and token auth out of the box. Users, sessions, and password resets without writing a line of backend code.</p>
            </div>
            <div className="idb-card">
              <div className="icon">⚡</div>
              <h3>Realtime database</h3>
              <p>Collections, relations, and live subscriptions. Your Flutter UI updates the moment data changes — no polling, no sockets to manage.</p>
            </div>
            <div className="idb-card">
              <div className="icon">🗂️</div>
              <h3>File storage</h3>
              <p>Uploads, images, and assets with access rules per collection. Serve them straight from your backend.</p>
            </div>
            <div className="idb-card">
              <div className="icon">🧠</div>
              <h3>Vector search, built in</h3>
              <p>Semantic search and RAG for your AI features with zero extra infrastructure. No Pinecone account, no second bill.</p>
            </div>
            <div className="idb-card">
              <div className="icon">🖥️</div>
              <h3>Admin UI</h3>
              <p>A full dashboard for your data: browse collections, manage users, inspect files. Your backend, visible.</p>
            </div>
            <div className="idb-card">
              <div className="icon">🎯</div>
              <h3>Dart-first SDKs</h3>
              <p>A first-class Dart SDK for Flutter, plus JavaScript and plain REST. One SDK for every backend feature.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="idb-section" id="how-it-works">
        <div className="idb-wrap">
          <h2>From signup to shipped in minutes</h2>
          <p className="lede">If you can paste a code snippet, you can run a backend.</p>
          <div className="idb-steps">
            <div className="idb-step">
              <span className="num">1</span>
              <h3>Sign up</h3>
              <p>An email address. That&apos;s the whole DevOps department. Your backend is provisioned automatically.</p>
            </div>
            <div className="idb-step">
              <span className="num">2</span>
              <h3>Grab your API keys</h3>
              <p>Copy your keys and the SDK snippet from the dashboard. Paste it into your Flutter app.</p>
            </div>
            <div className="idb-step">
              <span className="num">3</span>
              <h3>Ship it</h3>
              <p>Auth, data, files, and AI search — live. We keep it running; you keep building features.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="idb-section" id="pricing">
        <div className="idb-wrap">
          <h2>One price. No meters.</h2>
          <p className="lede">Stop doing Firebase math. This is the whole pricing page.</p>
          <div className="idb-pricing-card">
            <div className="tier">InvisibleDB Seat</div>
            <div className="amount">
              $6.99<span>/mo</span>
            </div>
            <div>
              <span className="first">First seat $1</span>
            </div>
            <ul>
              <li>Full backend: auth, realtime DB, storage, admin UI</li>
              <li>Vector search built in — no Pinecone needed</li>
              <li>Your data as SQLite files — take them anywhere</li>
              <li>No bandwidth meters, no surprise bills</li>
            </ul>
            <a className="idb-btn" href="/signup">
              Get started
            </a>
          </div>
          <p className="idb-devtier">
            <b>Just want to tinker?</b> The free dev tier lets you run InvisibleDB on your own
            hosting while you build. Upgrade when you&apos;re ready to stop thinking about servers.
          </p>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="idb-section" id="compare">
        <div className="idb-wrap">
          <h2>An honest comparison</h2>
          <p className="lede">We&apos;re not the right choice for everyone. Here&apos;s the real trade.</p>
          <div className="idb-table-wrap">
            <table className="idb-table">
              <thead>
                <tr>
                  <th></th>
                  <th>InvisibleDB</th>
                  <th>Firebase</th>
                  <th>PocketHost</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Price</td>
                  <td className="win">$6.99/mo flat · first seat $1</td>
                  <td>Free, then scales to hundreds</td>
                  <td>$9.99/mo per backend</td>
                </tr>
                <tr>
                  <td>Vector search</td>
                  <td className="win">Built in</td>
                  <td>Separate service, separate bill</td>
                  <td>Not included</td>
                </tr>
                <tr>
                  <td>Your data</td>
                  <td className="win">SQLite files — take them anywhere</td>
                  <td>Locked in Google Cloud</td>
                  <td>Managed on their infra</td>
                </tr>
                <tr>
                  <td>DevOps required</td>
                  <td className="win">Zero</td>
                  <td>Zero, until the bill arrives</td>
                  <td>Zero</td>
                </tr>
                <tr>
                  <td>Free tier</td>
                  <td className="win">Yes — dev tier</td>
                  <td>Yes — Spark plan</td>
                  <td>No</td>
                </tr>
                <tr>
                  <td>Track record</td>
                  <td>New — we earn it daily</td>
                  <td className="win">Google-scale, since 2011</td>
                  <td className="win">Trusted since 2021</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="idb-honest">
            Firebase wins at massive scale. PocketHost has years of trust. We win on price, on
            built-in AI search, and on the fact that your data is never held hostage.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="idb-section" id="faq">
        <div className="idb-wrap">
          <h2>Questions, answered straight</h2>
          <p className="lede">No marketing fog.</p>
          <div className="idb-faq">
            <details>
              <summary>What do I actually get?</summary>
              <p>
                A complete hosted backend per seat: user auth, a realtime database, file storage,
                a full admin UI, and built-in vector search — all reachable through one Dart SDK
                (plus JavaScript and REST). You write app code; the backend just exists.
              </p>
            </details>
            <details>
              <summary>Can I leave with my data?</summary>
              <p>
                Yes — that&apos;s the point. Your data lives in plain SQLite files. Export them
                any time, move them anywhere, run them yourself. We&apos;d rather keep you with a
                great product than with lock-in.
              </p>
            </details>
            <details>
              <summary>Do I need DevOps experience?</summary>
              <p>
                No. Sign up, copy your API keys, paste the snippet. There are no servers to
                configure, no containers to babysit, no YAML. If you&apos;ve ever added a package
                to pubspec.yaml, you already know enough.
              </p>
            </details>
            <details>
              <summary>What about scale?</summary>
              <p>
                Honest answer: InvisibleDB is built for indie apps growing into real businesses —
                thousands to hundreds of thousands of users, not billions. If you outgrow us,
                your SQLite files come with you. We&apos;d rather tell you the ceiling than
                discover it together at 3am.
              </p>
            </details>
            <details>
              <summary>Is the free tier really free?</summary>
              <p>
                Yes. Run InvisibleDB on your own hosting while you develop — full features, no
                card, no trial clock. When you want us to host it and stop thinking about
                servers, that&apos;s $6.99/mo (first seat $1).
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="idb-cta-band">
        <h2>Your backend, handled.</h2>
        <p>First seat is $1. Your data stays yours. What&apos;s stopping you?</p>
        <a className="idb-btn" href="/signup">
          Get started with InvisibleDB
        </a>
      </section>

      {/* FOOTER */}
      <footer className="idb-footer">
        <div className="idb-footer-inner">
          <div>
            <a className="idb-logo" href="/">
              <b>Invisible</b>DB
            </a>
            <p className="tag">The invisible backend for mobile apps.</p>
          </div>
          <nav>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="/signup">Sign in</a>
          </nav>
        </div>
        <div className="idb-footer-inner" style={{ marginTop: '1.5rem' }}>
          <p className="tag">© 2026 InvisibleDB. Built for indie hackers.</p>
        </div>
      </footer>
    </div>
  );
}
