export default function DashboardDocsPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#ff9f00', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Developer documentation</div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 'clamp(2rem,7vw,3.2rem)' }}>Build with InvisibleDB</h1>
        <p style={{ color: '#8b8b8b', maxWidth: 760, lineHeight: 1.65 }}>Documentation stays inside the control panel so you can move between your database and implementation guidance without leaving the application.</p>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
        <DocCard title="JavaScript / TypeScript" body="Initialize the SDK, authenticate, use collections, upload files, query vectors, and subscribe to realtime events." />
        <DocCard title="Dart / Flutter" body="Use the dedicated Dart SDK for Flutter and Dart applications." />
        <DocCard title="React Native" body="Mobile SDK guidance for secure user auth, storage, files, vectors, and realtime lifecycle handling." />
        <DocCard title="Swift / iOS" body="Native iOS integration with async networking, Keychain-backed sessions, files, vectors, and realtime." />
        <DocCard title="Kotlin / Android" body="Native Android integration using coroutines, OkHttp, secure token storage, files, vectors, and realtime." />
        <DocCard title="REST API" body="Use the HTTP API directly when an SDK is not appropriate for your environment." />
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Quick start</h2>
        <pre style={{ overflowX: 'auto', background: '#0b0b0b', border: '1px solid #202020', borderRadius: 10, padding: 14, fontSize: 13 }}>{`import { InvisibleDB } from 'invisibledb';\n\nconst db = new InvisibleDB({\n  baseUrl: 'https://YOUR_DB.invisibledb.app',\n  apiKey: process.env.INVISIBLEDB_KEY,\n});\n\nconst records = await db.collection('messages').getList();`}</pre>
      </section>
    </div>
  );
}

function DocCard({ title, body }: { title: string; body: string }) {
  return <section className="card"><h2 style={{ marginTop: 0, fontSize: 18 }}>{title}</h2><p style={{ color: '#999', lineHeight: 1.6, marginBottom: 0 }}>{body}</p></section>;
}
