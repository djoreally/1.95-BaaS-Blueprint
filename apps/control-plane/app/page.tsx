/** Landing — the approved journey starts here. */
export default function Landing() {
  return (
    <>
      <section className="hero">
        <h1>
          Everything PocketHost does,
          <br />
          on hosting you already pay $2 for.
        </h1>
        <p>
          1.95 BaaS turns your cheap cPanel shared hosting into a real backend
          platform: auth, database, storage, and vector search — one binary per
          project, provisioned in minutes. You keep the data files. No
          per-seat ransom.
        </p>
        <a className="btn" href="/signup">
          Get started — no credit card
        </a>
        <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
          Already have an account? <a href="/projects">Open your dashboard</a>
        </p>
      </section>

      <div className="grid2">
        <div className="card">
          <h2>How it works</h2>
          <ol>
            <li>
              <strong>Connect your hosting</strong> — paste a cPanel API token
              (never your password). A green preflight checklist proves the
              connection before anything is created.
            </li>
            <li>
              <strong>New project</strong> — pick a name. We create the
              subdomain, MySQL database, SSL certificate, and proxy rules.
            </li>
            <li>
              <strong>Minute 7: ship</strong> — your PocketBase backend is live
              at <code className="inline">https://your-project.yourdomain.com</code> with
              auth, realtime database, file storage, and an admin UI.
            </li>
          </ol>
        </div>
        <div className="card">
          <h2>Why not just use PocketHost?</h2>
          <p>
            PocketHost charges <strong>$9.99/mo per PocketBase</strong> on
            their infrastructure. 1.95 BaaS runs on the $1.95/mo hosting you
            already own — roughly <strong>$0.33 per backend</strong> — and the
            SQLite files stay on your server. Leave any time; take your data
            with you.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
            The moat is the experience, not the orchestration. The recipe is
            open; the product is the five-minute journey.
          </p>
        </div>
      </div>
    </>
  );
}
