/**
 * InvisibleDB — vector search playground.
 *
 * HONEST demo: ~13 sample documents with hand-crafted 8-dimensional toy embeddings.
 * Cosine similarity runs in plain JS in the browser. This is an interactive
 * illustration of the concept — it is NOT the production vector engine, and it
 * must never be mistaken for one.
 */
'use client';

import { useMemo, useState } from 'react';

/* ----------------------------- toy vector model ----------------------------- */

// Axes: [auth, realtime, storage, vector, pricing, sdk, ownership, security]
type Doc = {
  id: number;
  title: string;
  excerpt: string;
  tags: string[];
  vec: number[];
};

const DOCS: Doc[] = [
  {
    id: 1,
    title: 'Auth without the headache',
    excerpt:
      'Email/password, OAuth, and session tokens baked in — no auth server to run, no JWT library to wire up.',
    tags: ['auth'],
    vec: [1, 0, 0, 0, 0, 0, 0, 0.05],
  },
  {
    id: 2,
    title: 'Sessions, refresh, and revocation',
    excerpt:
      'Short-lived access tokens, silent refresh, and instant revocation when a user logs out everywhere.',
    tags: ['auth', 'security'],
    vec: [0.9, 0, 0, 0, 0, 0, 0, 0.2],
  },
  {
    id: 3,
    title: 'Realtime subscriptions',
    excerpt:
      'Subscribe to any record and get pushed updates the moment it changes. No polling, no refresh button.',
    tags: ['realtime'],
    vec: [0, 1, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 4,
    title: 'Offline-first live sync',
    excerpt:
      'Queue writes on flaky connections and merge them back when you are online — your data stays portable and yours.',
    tags: ['realtime', 'ownership'],
    vec: [0, 0.85, 0, 0, 0, 0, 0.35, 0],
  },
  {
    id: 5,
    title: 'File storage with a CDN',
    excerpt:
      'Upload files, get URLs, serve them fast worldwide — one bucket, zero config.',
    tags: ['storage'],
    vec: [0, 0, 1, 0, 0, 0, 0, 0],
  },
  {
    id: 6,
    title: 'Uploads, images, and transforms',
    excerpt:
      'Resize on the fly and serve responsive images from the same bucket your app already uploads to.',
    tags: ['storage'],
    vec: [0, 0, 0.9, 0, 0, 0, 0, 0.1],
  },
  {
    id: 7,
    title: 'Vector search, built in',
    excerpt:
      'Store embeddings next to your records and run semantic search — no Pinecone, no second bill.',
    tags: ['vector search', 'ai'],
    vec: [0, 0, 0, 1, 0, 0, 0, 0],
  },
  {
    id: 8,
    title: 'Embeddings for your documents',
    excerpt:
      'Turn docs into vectors and ask questions in plain English instead of matching keywords.',
    tags: ['vector search', 'ai', 'sdk'],
    vec: [0, 0, 0, 0.9, 0, 0.1, 0, 0],
  },
  {
    id: 9,
    title: 'One flat price',
    excerpt:
      '$6.99 a month per seat. No meters, no bandwidth math, no surprise bill after launch week.',
    tags: ['pricing'],
    vec: [0, 0, 0, 0, 1, 0, 0, 0],
  },
  {
    id: 10,
    title: 'Why the first seat is $1',
    excerpt:
      'Try the whole backend for a dollar. If it is not worth it, leave — your data files come with you.',
    tags: ['pricing', 'ownership'],
    vec: [0, 0, 0, 0, 0.8, 0, 0.45, 0],
  },
  {
    id: 11,
    title: 'Your database file is yours',
    excerpt:
      'Every seat ships as SQLite files you can download, inspect, and move anywhere. No lock-in, ever.',
    tags: ['ownership'],
    vec: [0, 0, 0, 0, 0, 0, 1, 0.15],
  },
  {
    id: 12,
    title: 'One SDK for web and mobile',
    excerpt:
      'The same calls from Dart, JavaScript, or plain REST — if you can fetch, you can ship.',
    tags: ['sdk'],
    vec: [0, 0, 0, 0, 0, 1, 0, 0],
  },
  {
    id: 13,
    title: 'Backups and encryption',
    excerpt:
      'Nightly snapshots and encryption at rest, automatic on every seat — nothing to configure.',
    tags: ['security'],
    vec: [0, 0, 0, 0, 0, 0, 0.1, 1],
  },
];

type SampleQuery = { label: string; vec: number[] };

const SAMPLES: SampleQuery[] = [
  { label: 'How do I log users in?', vec: [1, 0, 0, 0, 0, 0, 0, 0] },
  { label: 'Can my app get live updates?', vec: [0, 1, 0, 0, 0, 0, 0, 0] },
  { label: 'Where do I put user files?', vec: [0, 0, 1, 0, 0, 0, 0, 0] },
  { label: 'Do I need Pinecone?', vec: [0, 0, 0, 1, 0, 0, 0, 0] },
  { label: 'What does this cost?', vec: [0, 0, 0, 0, 1, 0, 0, 0] },
  { label: 'Can I export my data?', vec: [0, 0, 0, 0, 0, 0, 1, 0] },
  { label: 'Which SDK for Flutter?', vec: [0, 0, 0, 0, 0, 1, 0, 0] },
  { label: 'Is my data backed up?', vec: [0, 0, 0, 0, 0, 0, 0, 1] },
];

/** keyword -> [axis, weight] for free-text queries. Hand-built, same honesty contract. */
const KEYWORDS: Record<string, [number, number]> = {
  // auth
  login: [0, 1], sign: [0, 1], user: [0, 0.8], users: [0, 0.8], password: [0, 1], oauth: [0, 1],
  token: [0, 0.9], session: [0, 0.9], auth: [0, 1], register: [0, 1], account: [0, 0.7], logout: [0, 1],
  // realtime
  live: [1, 1], realtime: [1, 1], 'real-time': [1, 1], sync: [1, 1], subscription: [1, 1],
  subscribe: [1, 1], websocket: [1, 1], offline: [1, 0.9], push: [1, 0.8], update: [1, 0.5],
  // storage
  file: [2, 1], files: [2, 1], storage: [2, 1], upload: [2, 1], image: [2, 0.9], images: [2, 0.9],
  cdn: [2, 1], video: [2, 0.8], media: [2, 0.8], download: [2, 0.8], bucket: [2, 1],
  // vector
  vector: [3, 1], vectors: [3, 1], embedding: [3, 1], embeddings: [3, 1], semantic: [3, 1],
  search: [3, 0.7], ai: [3, 0.9], pinecone: [3, 1], rag: [3, 1], similarity: [3, 1],
  // pricing
  price: [4, 1], cost: [4, 1], pricing: [4, 1], pay: [4, 0.9], bill: [4, 0.9], meter: [4, 0.9],
  seat: [4, 1], dollar: [4, 0.9], expensive: [4, 0.9], cheap: [4, 0.9], flat: [4, 0.8],
  // sdk
  sdk: [5, 1], flutter: [5, 1], dart: [5, 1], web: [5, 0.8], mobile: [5, 0.8], rest: [5, 0.9],
  integration: [5, 0.7], javascript: [5, 0.8], js: [5, 0.7], code: [5, 0.5],
  // ownership
  export: [6, 1], own: [6, 0.9], data: [6, 0.8], portability: [6, 1], sqlite: [6, 1],
  migrate: [6, 0.9], lockin: [6, 1], 'lock-in': [6, 1], freedom: [6, 0.8], yours: [6, 0.9], leave: [6, 0.7],
  // security
  security: [7, 1], backup: [7, 1], backups: [7, 1], encrypt: [7, 1], secure: [7, 1],
  safe: [7, 0.7], privacy: [7, 0.9], breach: [7, 0.9], snapshot: [7, 1],
};

const AXIS_LABELS = ['auth', 'realtime', 'storage', 'vector', 'pricing', 'sdk', 'ownership', 'security'];

/* ---------------------------------- math ----------------------------------- */

function norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function cosine(a: number[], b: number[]): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot / (na * nb);
}

function fmtVec(v: number[]): string {
  return `[${v.map((x) => x.toFixed(2)).join(', ')}]`;
}

/**
 * Map free text to a toy vector via keyword hits. Returns the vector plus a
 * flag for "no keywords matched" so the UI can say so plainly.
 */
function vectorizeFreeText(text: string): { vec: number[]; matched: string[] } {
  const vec = new Array(8).fill(0);
  const matched: string[] = [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9$-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  for (const w of words) {
    const hit = KEYWORDS[w];
    if (hit && !matched.includes(w)) {
      matched.push(w);
      vec[hit[0]] += hit[1];
    }
  }
  if (matched.length === 0) {
    // Deterministic pseudo-random fallback — labeled as meaningless in the UI.
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    for (let i = 0; i < 8; i++) {
      h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
      vec[i] = ((h >>> 0) % 100) / 100;
    }
  }
  return { vec, matched };
}

/* ----------------------------------- UI ------------------------------------ */

type Ranked = { doc: Doc; score: number };

export default function VectorPlaygroundPage() {
  const [queryLabel, setQueryLabel] = useState<string>(SAMPLES[0].label);
  const [customText, setCustomText] = useState('');
  const [mode, setMode] = useState<'sample' | 'custom'>('sample');

  const search = useMemo((): { ranked: Ranked[]; qvec: number[]; matched: string[]; fallback: boolean } => {
    let qvec: number[];
    let matched: string[] = [];
    let fallback = false;
    if (mode === 'sample') {
      qvec = SAMPLES.find((s) => s.label === queryLabel)?.vec ?? SAMPLES[0].vec;
    } else {
      const r = vectorizeFreeText(customText);
      qvec = r.vec;
      matched = r.matched;
      fallback = r.matched.length === 0;
    }
    const ranked = DOCS.map((doc) => ({ doc, score: cosine(qvec, doc.vec) })).sort(
      (a, b) => b.score - a.score
    );
    return { ranked, qvec, matched, fallback };
  }, [queryLabel, customText, mode]);

  const top = search.ranked[0];

  return (
    <div className="m-page">
      <style>{`
        .vp-hero { text-align: center; padding: 4rem 1.5rem 2.5rem; max-width: 52rem; margin: 0 auto; }
        .vp-honest {
          border: 1px solid rgba(245,158,11,0.45); background: var(--amber-dim);
          border-radius: 12px; padding: 1.1rem 1.4rem; margin: 0 auto 2rem; max-width: 52rem;
          font-size: 0.95rem; line-height: 1.65;
        }
        .vp-honest strong { color: var(--amber); }
        .vp-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0 1.25rem; }
        .vp-chip {
          background: var(--bg-softer); border: 1px solid var(--line); color: var(--ink);
          border-radius: 999px; padding: 0.45rem 1rem; font-size: 0.9rem; cursor: pointer; font-family: inherit;
        }
        .vp-chip:hover { border-color: var(--faint); }
        .vp-chip.active { border-color: var(--amber); background: var(--amber-dim); color: var(--amber); font-weight: 700; }
        .vp-row { display: flex; gap: 0.75rem; }
        .vp-row input { flex: 1; }
        .vp-result { display: flex; gap: 1rem; align-items: flex-start; padding: 1rem 0; border-bottom: 1px solid var(--line-soft); }
        .vp-result:last-child { border-bottom: none; }
        .vp-rank {
          flex-shrink: 0; width: 2rem; height: 2rem; border-radius: 999px;
          border: 1px solid var(--line); display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 0.85rem; color: var(--muted);
        }
        .vp-result.first .vp-rank { background: var(--amber); border-color: var(--amber); color: #0a0a0b; }
        .vp-body { flex: 1; min-width: 0; }
        .vp-title { font-weight: 700; font-size: 1.02rem; margin-bottom: 0.15rem; }
        .vp-excerpt { color: var(--muted); font-size: 0.92rem; line-height: 1.6; margin: 0 0 0.5rem; }
        .vp-score-row { display: flex; align-items: center; gap: 0.75rem; }
        .vp-bar { flex: 1; height: 0.5rem; background: #1c1c1f; border-radius: 999px; overflow: hidden; }
        .vp-bar i { display: block; height: 100%; background: var(--amber); border-radius: 999px; }
        .vp-score { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; color: var(--amber); font-size: 0.9rem; white-space: nowrap; }
        .vp-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.5rem; }
        .vp-tag { font-size: 0.75rem; color: var(--faint); border: 1px solid var(--line); border-radius: 999px; padding: 0.1rem 0.6rem; }
        .vp-vectors { margin-top: 1.5rem; }
        .vp-vectors summary { cursor: pointer; font-weight: 700; font-size: 0.9rem; color: var(--muted); }
        .vp-vec { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; color: var(--muted); margin: 0.5rem 0 0; word-break: break-all; }
        .vp-vec b { color: var(--amber); font-weight: 700; }
        .vp-math { font-size: 0.9rem; color: var(--muted); margin-top: 1rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .vp-mode-tabs { display: flex; gap: 0.25rem; border-bottom: 2px solid var(--line); margin-bottom: 1rem; }
        .vp-mode-tabs button { background: none; border: none; padding: 0.6rem 1rem; font-size: 0.95rem; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: inherit; }
        .vp-mode-tabs button.active { color: var(--ink); font-weight: 700; border-bottom-color: var(--amber); }
        .vp-warn { border-left: 4px solid var(--red); background: rgba(248,113,113,0.08); padding: 0.8rem 1.1rem; border-radius: 0 10px 10px 0; margin: 1rem 0; font-size: 0.9rem; color: var(--muted); }
        .vp-warn strong { color: var(--red); }
        .vp-axis-key { display: flex; flex-wrap: wrap; gap: 0.35rem 0.9rem; font-size: 0.8rem; color: var(--faint); margin-top: 0.75rem; }
        .vp-axis-key code { color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      `}</style>

      <div className="vp-hero">
        <span className="m-kicker-pill">Interactive illustration</span>
        <h1>
          Vector search, <span className="hl">under the glass.</span>
        </h1>
        <p className="sub">
          Semantic search in one screen: documents become vectors, your query becomes a
          vector, and cosine similarity ranks what matches — no keyword matching anywhere.
        </p>
      </div>

      <div className="m-wrap" style={{ paddingBottom: '5rem' }}>
        <div className="vp-honest">
          <strong>Interactive illustration — not the production engine.</strong> Every
          document below carries a hand-made 8-dimensional toy embedding, and every
          score is cosine similarity computed live in your browser by plain JavaScript.
          The production InvisibleDB vector engine does the same math on real embeddings;
          this page exists so you can watch the idea work before you trust it.
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.25rem' }}>Your query</h2>
          <div className="vp-mode-tabs" role="tablist" aria-label="Query mode">
            <button
              type="button"
              className={mode === 'sample' ? 'active' : ''}
              onClick={() => setMode('sample')}
            >
              Sample queries
            </button>
            <button
              type="button"
              className={mode === 'custom' ? 'active' : ''}
              onClick={() => setMode('custom')}
            >
              Type your own
            </button>
          </div>

          {mode === 'sample' ? (
            <div className="vp-chips">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className={`vp-chip${queryLabel === s.label ? ' active' : ''}`}
                  onClick={() => setQueryLabel(s.label)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <form
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="vp-row">
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="e.g. how do I store profile pictures cheaply"
                  aria-label="Your question"
                />
                <button className="btn" type="submit">
                  Search
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--faint)', margin: '0.6rem 0 0' }}>
                Free text is mapped to a toy vector by matching known keywords (login,
                realtime, files, vector, price, SDK, export, backup…). Try words from the
                sample queries.
              </p>
            </form>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.25rem' }}>
            Ranked results{' '}
            <span style={{ color: 'var(--faint)', fontWeight: 400, fontSize: '0.95rem' }}>
              — {search.ranked.length} documents scored
            </span>
          </h2>

          {mode === 'custom' && search.fallback && (
            <div className="vp-warn">
              <strong>No keywords matched.</strong> Your text hit none of the demo's known
              words, so it got a deterministic pseudo-random toy vector — these scores are
              meaningless. Pick a sample query for a real demonstration.
            </div>
          )}

          {mode === 'custom' && !search.fallback && search.matched.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--faint)', margin: '0 0 1rem' }}>
              Matched keywords:{' '}
              {search.matched.map((w) => (
                <code className="m-inline-code" key={w} style={{ marginRight: '0.35rem' }}>
                  {w}
                </code>
              ))}
            </p>
          )}

          <div>
            {search.ranked.map((r, i) => (
              <div key={r.doc.id} className={`vp-result${i === 0 ? ' first' : ''}`}>
                <div className="vp-rank">{i + 1}</div>
                <div className="vp-body">
                  <div className="vp-title">{r.doc.title}</div>
                  <p className="vp-excerpt">{r.doc.excerpt}</p>
                  <div className="vp-score-row">
                    <div className="vp-bar" aria-hidden="true">
                      <i style={{ width: `${Math.max(0, Math.min(100, r.score * 100))}%` }} />
                    </div>
                    <span className="vp-score">{(r.score * 100).toFixed(1)}%</span>
                  </div>
                  <div className="vp-tags">
                    {r.doc.tags.map((t) => (
                      <span key={t} className="vp-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="vp-math">
            score = (A·B) / (|A|·|B|) — cosine similarity, {top.score.toFixed(4)} for the
            top hit
          </p>

          <details className="vp-vectors">
            <summary>Show the raw toy vectors (full transparency)</summary>
            <p className="vp-vec">
              <b>query</b> “{mode === 'sample' ? queryLabel : customText || '(empty)'}” ={' '}
              {fmtVec(search.qvec)}
            </p>
            <p className="vp-vec">
              <b>top doc</b> “{top.doc.title}” = {fmtVec(top.doc.vec)}
            </p>
            <div className="vp-axis-key">
              {AXIS_LABELS.map((a, i) => (
                <span key={a}>
                  <code>[{i}]</code> {a}
                </span>
              ))}
            </div>
          </details>
        </div>

        <div className="callout">
          <p>
            <strong>What you are actually seeing:</strong> each document's vector was typed
            by hand so related topics sit near each other. Real embeddings come from a
            model trained on language — the ranking math is identical, the vectors are
            just smarter. InvisibleDB ships this capability built in: no Pinecone, no
            second bill.
          </p>
        </div>
      </div>
    </div>
  );
}
