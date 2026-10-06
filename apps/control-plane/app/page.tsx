/**
 * InvisibleDB — home page.
 * Full marketing site home: hero, Firebase trap, features, how-it-works,
 * comparison teaser, CTA band. Nav/footer come from the shared layout.
 */
export default function HomePage() {
  return (
    <div className="m-page">
      {/* HERO */}
      <section className="m-hero">
        <span className="m-kicker-pill">Built for Flutter &amp; indie mobile devs</span>
        <h1>
          Every backend Firebase gives you. <span className="hl">None of the bill.</span>
        </h1>
        <p className="sub">
          InvisibleDB is the invisible backend: auth, realtime database, file storage, and
          built-in vector search — through one Dart SDK. For the price of a coffee. And the
          database file is yours.
        </p>
        <div className="m-hero-ctas">
          <a className="m-btn" href="/signup">
            Get started
          </a>
          <a className="m-btn ghost" href="/pricing">
            See pricing
          </a>
        </div>
        <p className="m-fineprint">First seat $1 · No credit card to start</p>
      </section>

      {/* PROBLEM */}
      <section className="m-section">
        <div className="m-wrap">
          <div className="m-section-head">
            <h2>The Firebase trap</h2>
            <p className="lede">
              You start on the free tier. Then your app gets traction — and your backend bill
              goes from $0 to $500 overnight. Metered everything, per-seat premiums, and your
              data locked inside someone else&apos;s cloud.
            </p>
          </div>
          <div className="m-bill">
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
              InvisibleDB charges one flat price per seat. No meters, no surprise bills, and
              your data lives in SQLite files you can take anywhere — including away from us.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="m-section" id="features">
        <div className="m-wrap">
          <div className="m-section-head">
            <span className="kicker">Product</span>
            <h2>Everything your app needs. Nothing it doesn&apos;t.</h2>
            <p className="lede">One backend, one SDK, zero servers to babysit.</p>
          </div>
          <div className="m-grid">
            <div className="m-card">
              <div className="icon">🔐</div>
              <h3>Auth</h3>
              <p>
                Email, OAuth, and token auth out of the box. Users, sessions, and password
                resets without writing a line of backend code.
              </p>
            </div>
            <div className="m-card">
              <div className="icon">⚡</div>
              <h3>Realtime database</h3>
              <p>
                Collections, relations, and live subscriptions. Your Flutter UI updates the
                moment data changes — no polling, no sockets to manage.
              </p>
            </div>
            <div className="m-card">
              <div className="icon">🗂️</div>
              <h3>File storage</h3>
              <p>
                Uploads, images, and assets with access rules per collection. Serve them
                straight from your backend.
              </p>
            </div>
            <div className="m-card">
              <div className="icon">🧠</div>
              <h3>Vector search, built in</h3>
              <p>
                Semantic search and RAG for your AI features with zero extra infrastructure.
                No Pinecone account, no second bill.
              </p>
            </div>
            <div className="m-card">
              <div className="icon">🖥️</div>
              <h3>Admin UI</h3>
              <p>
                A full dashboard for your data: browse collections, manage users, inspect
                files. Your backend, visible.
              </p>
            </div>
            <div className="m-card">
              <div className="icon">🤖</div>
              <h3>Agent-native</h3>
              <p>
                MCP server, REST API, and CLI for AI-assisted development — plus the ZeroAI
                agent OS: memory, audit trails, and permission gates for your agents.{' '}
                <a href="/agents">Learn more →</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="m-section" id="how-it-works">
        <div className="m-wrap">
          <div className="m-section-head">
            <span className="kicker">How it works</span>
            <h2>From signup to shipped in minutes</h2>
            <p className="lede">If you can paste a code snippet, you can run a backend.</p>
          </div>
          <div className="m-steps">
            <div className="m-step">
              <span className="num">1</span>
              <h3>Sign up</h3>
              <p>
                An email address. That&apos;s the whole DevOps department. Your backend is
                provisioned automatically.
              </p>
            </div>
            <div className="m-step">
              <span className="num">2</span>
              <h3>Grab your API keys</h3>
              <p>
                Copy your keys and the SDK snippet from the dashboard. Paste it into your
                Flutter app.
              </p>
            </div>
            <div className="m-step">
              <span className="num">3</span>
              <h3>Ship it</h3>
              <p>
                Auth, data, files, and AI search — live. We keep it running; you keep
                building features.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON TEASER */}
      <section className="m-section" id="compare">
        <div className="m-wrap">
          <div className="m-section-head">
            <span className="kicker">Why switch</span>
            <h2>An honest comparison</h2>
            <p className="lede">
              Firebase wins at massive scale. PocketHost has years of trust. We win on price,
              on built-in AI search, and on the fact that your data is never held hostage.
            </p>
          </div>
          <div className="m-table-wrap">
            <table className="m-table">
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
            </a>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="m-cta-band">
        <h2>Your backend, handled.</h2>
        <p>First seat is $1. Your data stays yours. What&apos;s stopping you?</p>
        <a className="m-btn" href="/signup">
          Get started with InvisibleDB
        </a>
      </section>
    </div>
  );
}
