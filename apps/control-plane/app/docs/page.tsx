/**
 * InvisibleDB — documentation / getting started.
 */
export default function DocsPage() {
  return (
    <div className="m-page">
      {/* HERO */}
      <section className="m-hero">
        <span className="kicker">Documentation</span>
        <h1>
          Ship in <span className="hl">five minutes.</span>
        </h1>
        <p className="sub">
          Sign up, grab your keys, paste the snippet. Web app or mobile app — if you
          can make an HTTP call, you already know enough.
        </p>
      </section>

      {/* STEPS */}
      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap">
          <div className="m-docs-grid">
            <div className="m-doc-step">
              <div className="step-label">Step 1 — Sign up</div>
              <h3>Create your account</h3>
              <p>
                An email address and you&apos;re in — first seat is $1, no credit card to
                start. Your backend is provisioned automatically the moment your account
                exists.
              </p>
            </div>

            <div className="m-doc-step">
              <div className="step-label">Step 2 — API keys</div>
              <h3>Grab your keys</h3>
              <p>
                Open your project dashboard and copy the API keys. Each project gets its own
                isolated keys — rotate them any time from the dashboard. Keys are scoped to
                your data and nothing else.
              </p>
            </div>

            <div className="m-doc-step" id="web">
              <div className="step-label">Track A — Web apps</div>
              <h3>Drop it into your frontend</h3>
              <p>
                Any framework — React, Next.js, Vue, or plain JavaScript. Auth, data,
                and realtime subscriptions over HTTPS:
              </p>
              <pre className="code">{`// npm i invisibledb
import { InvisibleDB } from 'invisibledb';

const db = new InvisibleDB({
  baseUrl: 'https://your-app.invisibledb.app',
  apiKey: 'YOUR_API_KEY',
});

// Auth + realtime
await db.auth.signIn('you@example.com', 'password');
const messages = await db.collection('messages').getList();
db.collection('messages').subscribe((e) => {
  console.log('live update:', e.action);
});`}</pre>
            </div>

            <div className="m-doc-step" id="mobile">
              <div className="step-label">Track B — Mobile apps</div>
              <h3>Built for the mobile situation</h3>
              <p>
                Mobile lives on flaky connections and backgrounded processes. The Dart
                SDK is first-class — offline-tolerant realtime, auth that survives app
                restarts, and the same one-call vector search for on-device AI features.
                React Native, Swift, and Kotlin go through plain REST below:
              </p>
              <pre className="code">{`// pubspec.yaml
dependencies:
  invisibledb: ^1.0.0

// main.dart
import 'package:invisibledb/invisibledb.dart';

final db = InvisibleDB(
  baseUrl: 'https://your-app.invisibledb.app',
  apiKey: 'YOUR_API_KEY',
);

// Auth
await db.auth.signIn('you@example.com', 'password');

// Realtime collection
final messages = await db.collection('messages').getList();
db.collection('messages').subscribe((e) {
  print('live update: \${e.action}');
});`}</pre>
            </div>

            <div className="m-doc-step" id="rest">
              <div className="step-label">Universal — REST API</div>
              <h3>Plain HTTP when you need it</h3>
              <p>
                Every SDK call maps to a REST endpoint. Anything that speaks HTTP —
                Swift, Kotlin, curl, your CI — can talk to your backend:
              </p>
              <pre className="code">{`# List records
curl https://your-app.invisibledb.app/api/collections/messages/records \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Create a record
curl -X POST https://your-app.invisibledb.app/api/collections/messages/records \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "hello from curl"}'`}</pre>
            </div>

            <div className="m-doc-step">
              <div className="step-label">Universal — Vector search</div>
              <h3>AI search without a second bill</h3>
              <p>
                Semantic search and RAG are built into every seat. Embed your documents
                once, then query with one authenticated call — no Pinecone account, no
                separate infrastructure:
              </p>
              <pre className="code">{`# Semantic search over your collection
curl -X POST https://your-app.invisibledb.app/api/vector/query \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "collection": "docs",
    "vector": [0.12, -0.44, 0.91],
    "limit": 5
  }'`}</pre>
              <p>
                Vectors live alongside your data in the same SQLite files — which means
                they leave with you, too.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="m-cta-band">
        <h2>Ready to build?</h2>
        <p>First seat is $1. The docs are short because the product is simple.</p>
        <a className="m-btn" href="/signup">
          Get started
        </a>
      </section>
    </div>
  );
}
