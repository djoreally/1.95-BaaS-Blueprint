/**
 * InvisibleDB — API playground.
 *
 * Live client-side requests against the demo backend (https://demo.innovarel.dev).
 * Preset buttons, editable method/URL/body, and a hand-rolled JSON highlighter.
 * Read-only endpoints; 401s are surfaced honestly.
 */
'use client';

import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const DEMO = 'https://demo.innovarel.dev';

type Preset = {
  name: string;
  desc: string;
  method: string;
  url: string;
  body: string;
};

const PRESETS: Preset[] = [
  {
    name: 'Health check',
    desc: 'Is the backend alive? Returns 200, no auth needed.',
    method: 'GET',
    url: `${DEMO}/api/health`,
    body: '',
  },
  {
    name: 'Read records',
    desc: 'Pull records from the public users collection, paginated.',
    method: 'GET',
    url: `${DEMO}/api/collections/users/records?page=1&perPage=5`,
    body: '',
  },
  {
    name: 'Filtered records',
    desc: 'PocketBase filter syntax — same endpoint, server-side filter.',
    method: 'GET',
    url: `${DEMO}/api/collections/users/records?perPage=5&filter=verified=true`,
    body: '',
  },
  {
    name: 'List collections',
    desc: 'Protected endpoint — the demo answers 401 without an auth token.',
    method: 'GET',
    url: `${DEMO}/api/collections`,
    body: '',
  },
  {
    name: 'Missing collection',
    desc: 'What a 404 looks like — ask for a collection that does not exist.',
    method: 'GET',
    url: `${DEMO}/api/collections/does_not_exist/records`,
    body: '',
  },
];

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

type ApiResult = {
  status: number;
  statusText: string;
  ms: number;
  headers: { name: string; value: string }[];
  text: string;
  json: unknown | null;
};

type ToolError = { message: string; detail: string };

function httpVerdict(status: number): string {
  if (status === 200)
    return 'OK — the backend answered with a JSON payload. No auth token was needed for this one.';
  if (status === 401)
    return 'This endpoint requires an auth token (Authorization header). The demo does not publish admin keys, so this is exactly what a protected endpoint looks like from the outside.';
  if (status === 403)
    return 'Forbidden — the request was authenticated but the rule set says no.';
  if (status === 404)
    return 'Not found — no such route or collection on the demo instance.';
  if (status === 400)
    return 'Bad request — the URL or query parameters failed validation.';
  if (status >= 500)
    return 'Server error — something went wrong on the backend, not in your request.';
  return '';
}

/** Hand-rolled JSON syntax highlighting — no new dependencies. */
function highlightJson(source: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let last = 0;
  let key = 0;
  for (;;) {
    const m = re.exec(source);
    if (!m) break;
    if (m.index > last) out.push(<span key={key++}>{source.slice(last, m.index)}</span>);
    const cls = m[1] ? (m[2] ? 'j-key' : 'j-str') : m[3] ? 'j-lit' : 'j-num';
    out.push(
      <span key={key++} className={cls}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < source.length) out.push(<span key={key++}>{source.slice(last)}</span>);
  return out;
}

function looksLikeJson(text: string): unknown | null {
  const t = text.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function curlSnippet(method: string, url: string, body: string): string {
  const hasBody = body.trim() !== '' && method !== 'GET' && method !== 'DELETE';
  return `curl -X ${method} ${JSON.stringify(url)}${
    hasBody ? ` \\\n  -H "Content-Type: application/json" \\\n  -d ${JSON.stringify(body.trim())}` : ''
  }`;
}

export default function ApiPlaygroundPage() {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState(PRESETS[0].url);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<ToolError | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(PRESETS[0].name);
  const [curlOpen, setCurlOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const applyPreset = useCallback((p: Preset) => {
    setMethod(p.method);
    setUrl(p.url);
    setBody(p.body);
    setActivePreset(p.name);
    setResult(null);
    setError(null);
    setCurlOpen(false);
  }, []);

  const send = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setResult(null);
    setError(null);

    const headers: Record<string, string> = { Accept: 'application/json' };
    const upper = method.toUpperCase();
    const hasBody = body.trim() !== '' && upper !== 'GET' && upper !== 'DELETE';
    if (hasBody) headers['Content-Type'] = 'application/json';

    const t0 = performance.now();
    try {
      const res = await fetch(url, {
        method: upper,
        headers,
        body: hasBody ? body.trim() : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      const ms = Math.max(1, Math.round(performance.now() - t0));
      const hdrs: { name: string; value: string }[] = [];
      res.headers.forEach((value, name) => hdrs.push({ name, value }));
      setResult({ status: res.status, statusText: res.statusText, ms, headers: hdrs, text, json: looksLikeJson(text) });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setLoading(false);
        return;
      }
      setError({
        message: 'Could not reach the demo server.',
        detail:
          'This usually means your network dropped the request — or your browser blocked it as a cross-origin request (CORS). ' +
          'The demo backend allows cross-origin GETs, so if you see this, check your connection and try again. ' +
          'Note: write methods (POST/PUT/PATCH/DELETE) against the demo will fail auth before anything else.',
      });
    } finally {
      setLoading(false);
    }
  }, [method, url, body]);

  const showBodyField = method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'DELETE';

  return (
    <div className="m-page">
      <style>{`
        .tp-hero { text-align: center; padding: 4rem 1.5rem 2.5rem; max-width: 52rem; margin: 0 auto; }
        .tp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; align-items: start; }
        @media (max-width: 860px) { .tp-grid { grid-template-columns: 1fr; } }
        .tp-presets { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.25rem; }
        .tp-preset {
          text-align: left; background: var(--bg-softer); border: 1px solid var(--line);
          border-radius: 10px; padding: 0.75rem 1rem; cursor: pointer; color: var(--ink);
          font-family: inherit; font-size: 0.95rem;
        }
        .tp-preset:hover { border-color: var(--faint); }
        .tp-preset.active { border-color: var(--amber); background: var(--amber-dim); }
        .tp-preset .p-name { font-weight: 700; }
        .tp-preset .p-desc { color: var(--muted); font-size: 0.85rem; display: block; margin-top: 0.15rem; }
        .tp-row { display: flex; gap: 0.75rem; }
        .tp-row select { width: 8.5rem; flex-shrink: 0; }
        .tp-actions { display: flex; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap; align-items: center; }
        .tp-result-head { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .tp-status { font-weight: 800; font-size: 1.05rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .tp-meta { color: var(--faint); font-size: 0.85rem; }
        pre.tp-code {
          background: #0d0d0e; border: 1px solid var(--line); color: #e7e5e4;
          padding: 1.1rem 1.25rem; border-radius: 10px; overflow-x: auto;
          font-size: 0.82rem; line-height: 1.65; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          white-space: pre-wrap; word-break: break-word; max-height: 32rem; overflow-y: auto; margin: 0;
        }
        .j-key { color: var(--amber); font-weight: 700; }
        .j-str { color: #e7e5e4; }
        .j-num { color: #fcd34d; }
        .j-lit { color: #fcd34d; }
        .tp-headers { margin-top: 1rem; }
        .tp-headers summary { cursor: pointer; font-weight: 700; font-size: 0.9rem; color: var(--muted); }
        .tp-headers table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.82rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .tp-headers td { padding: 0.35rem 0.6rem; border-bottom: 1px solid var(--line-soft); vertical-align: top; word-break: break-all; }
        .tp-headers td:first-child { color: var(--muted); white-space: nowrap; }
        .tp-verdict { margin-top: 1rem; }
        .tp-err { border: 1px solid rgba(248,113,113,0.5); background: rgba(248,113,113,0.08); border-radius: 10px; padding: 1rem 1.25rem; }
        .tp-err strong { color: var(--red); }
        .tp-err p { color: var(--muted); font-size: 0.93rem; margin: 0.5rem 0 0; line-height: 1.65; }
        .tp-empty { color: var(--faint); font-size: 0.95rem; text-align: center; padding: 3rem 1rem; }
        .tp-curl pre { margin: 0.75rem 0 0; }
        .tp-note { font-size: 0.85rem; color: var(--faint); margin-top: 1rem; }
      `}</style>

      <div className="tp-hero">
        <span className="m-kicker-pill">Live demo · demo.innovarel.dev</span>
        <h1>
          API <span className="hl">playground.</span>
        </h1>
        <p className="sub">
          Real HTTP, real backend, running in your browser. Pick a preset or write your own
          request and watch the response come back — including what the protected endpoints do.
        </p>
      </div>

      <div className="m-wrap" style={{ paddingBottom: '5rem' }}>
        <div className="tp-grid">
          {/* REQUEST */}
          <div className="card">
            <h2 style={{ fontSize: '1.25rem' }}>Request</h2>
            <div className="tp-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  className={`tp-preset${activePreset === p.name ? ' active' : ''}`}
                  onClick={() => applyPreset(p)}
                  type="button"
                >
                  <span className="p-name">{p.name}</span>
                  <span className="p-desc">{p.desc}</span>
                </button>
              ))}
            </div>
            <div className="field">
              <label htmlFor="tp-method">Method</label>
              <div className="tp-row">
                <select
                  id="tp-method"
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value);
                    setActivePreset(null);
                  }}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="tp-url">URL</label>
              <input
                id="tp-url"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setActivePreset(null);
                }}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            {showBodyField && (
              <div className="field">
                <label htmlFor="tp-body">Body (JSON)</label>
                <textarea
                  id="tp-body"
                  rows={5}
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    setActivePreset(null);
                  }}
                  placeholder='{"name": "value"}'
                  spellCheck={false}
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem' }}
                />
              </div>
            )}
            <div className="tp-actions">
              <button className="btn" onClick={send} disabled={loading} type="button">
                {loading ? 'Sending…' : 'Send request'}
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => setCurlOpen((v) => !v)}
              >
                {curlOpen ? 'Hide curl' : 'Show as curl'}
              </button>
            </div>
            {curlOpen && (
              <div className="tp-curl">
                <pre className="tp-code">{curlSnippet(method, url, body)}</pre>
              </div>
            )}
            <p className="tp-note">
              Read-only endpoints need no auth. Anything that writes, or touches collection
              metadata, will answer 401 — the demo backend publishes no admin keys.
            </p>
          </div>

          {/* RESPONSE */}
          <div className="card">
            <h2 style={{ fontSize: '1.25rem' }}>Response</h2>
            {loading && (
              <div className="tp-empty">Waiting on the demo server…</div>
            )}
            {!loading && error && (
              <div className="tp-err">
                <strong>{error.message}</strong>
                <p>{error.detail}</p>
              </div>
            )}
            {!loading && !error && !result && (
              <div className="tp-empty">
                Pick a preset or hit <b style={{ color: 'var(--ink)' }}>Send request</b> —
                the raw response lands here with timing and headers.
              </div>
            )}
            {!loading && !error && result && (
              <>
                <div className="tp-result-head">
                  <span className={`badge ${result.status < 400 ? 'up' : 'down'}`}>
                    {result.status} {result.statusText}
                  </span>
                  <span className="tp-meta">{result.ms} ms · {result.text.length.toLocaleString()} bytes</span>
                </div>
                <pre className="tp-code">
                  {result.json !== null ? highlightJson(JSON.stringify(result.json, null, 2)) : result.text || '(empty body)'}
                </pre>
                {httpVerdict(result.status) && (
                  <div className="callout tp-verdict">
                    <p>{httpVerdict(result.status)}</p>
                  </div>
                )}
                {result.headers.length > 0 && (
                  <details className="tp-headers">
                    <summary>Response headers ({result.headers.length})</summary>
                    <table>
                      <tbody>
                        {result.headers.map((h) => (
                          <tr key={h.name}>
                            <td>{h.name}</td>
                            <td>{h.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
