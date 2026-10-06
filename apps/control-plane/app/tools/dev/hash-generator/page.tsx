/**
 * InvisibleDB — Hash Generator.
 *
 * SHA-256 / SHA-384 / SHA-512 via crypto.subtle.digest. Hex output.
 */
'use client';

import { useState } from 'react';
import { CopyButton, SecurityNote, ToolHero } from '../components';

type Algo = 'SHA-256' | 'SHA-384' | 'SHA-512';

const ALGOS: Algo[] = ['SHA-256', 'SHA-384', 'SHA-512'];

async function digest(algo: Algo, text: string): Promise<string> {
  if (!crypto.subtle) {
    throw new Error('Web Crypto is unavailable (needs HTTPS or localhost).');
  }
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
}

export default function HashGeneratorPage() {
  const [algo, setAlgo] = useState<Algo>('SHA-256');
  const [input, setInput] = useState('');
  const [hash, setHash] = useState('');
  const [error, setError] = useState('');

  const compute = async (a: Algo = algo, text: string = input) => {
    setError('');
    try {
      setHash(await digest(a, text));
    } catch (e) {
      setHash('');
      setError(e instanceof Error ? e.message : 'Hashing failed.');
    }
  };

  return (
    <div className="m-page">
      <ToolHero
        kicker="Developer tools"
        title={<>Hash <span className="hl">Generator</span></>}
        lede="SHA-256, SHA-384, and SHA-512 digests — computed with the Web Crypto API, never sent anywhere."
      />

      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap" style={{ maxWidth: '56rem' }}>
          <div className="field">
            <label>Algorithm</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ALGOS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="m-btn ghost small"
                  onClick={() => {
                    setAlgo(a);
                    compute(a, input);
                  }}
                  style={
                    algo === a
                      ? { borderColor: 'var(--amber)', color: 'var(--amber)', fontWeight: 700 }
                      : undefined
                  }
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginTop: '1.25rem' }}>
            <label>Input text</label>
            <textarea
              rows={5}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                compute(algo, e.target.value);
              }}
              placeholder="Type or paste text to hash…"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.92rem' }}
            />
          </div>

          {error && (
            <div className="callout">
              <p>{error}</p>
            </div>
          )}

          {hash && (
            <div
              style={{
                padding: '1rem 1.25rem',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                background: 'var(--bg-soft)',
                marginTop: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{algo} digest</strong>
                <CopyButton text={hash} small />
              </div>
              <code
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '0.85rem',
                  wordBreak: 'break-all',
                  color: 'var(--ink)',
                }}
              >
                {hash}
              </code>
            </div>
          )}

          <SecurityNote />
        </div>
      </section>
    </div>
  );
}
