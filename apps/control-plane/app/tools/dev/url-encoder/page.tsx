/**
 * InvisibleDB — URL Encoder / Decoder.
 *
 * Full-URL encoding (encodeURI) and component encoding (encodeURIComponent).
 */
'use client';

import { useState } from 'react';
import { CopyButton, SecurityNote, ToolHero } from '../components';

export default function UrlEncoderPage() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const safe = (fn: () => string): string => {
    try {
      setError('');
      return fn();
    } catch {
      setError('Invalid input — malformed percent-encoding.');
      return '';
    }
  };

  const componentEncoded = input ? safe(() => encodeURIComponent(input)) : '';
  const fullEncoded = input ? safe(() => encodeURI(input)) : '';
  const decoded = input ? safe(() => decodeURIComponent(input)) : '';

  const Result = ({ label, value }: { label: string; value: string }) =>
    value ? (
      <div
        style={{
          padding: '1rem 1.25rem',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          background: 'var(--bg-soft)',
          marginTop: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <strong style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{label}</strong>
          <CopyButton text={value} small />
        </div>
        <code
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.85rem',
            wordBreak: 'break-all',
            color: 'var(--ink)',
          }}
        >
          {value}
        </code>
      </div>
    ) : null;

  return (
    <div className="m-page">
      <ToolHero
        kicker="Developer tools"
        title={<>URL <span className="hl">Encoder / Decoder</span></>}
        lede="Percent-encoding for full URLs and for individual components — query params, slugs, the works."
      />

      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap" style={{ maxWidth: '56rem' }}>
          <div className="field">
            <label>Input</label>
            <textarea
              rows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://example.com/search?q=hello world&lang=fr"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.92rem' }}
            />
            <p className="hint">
              Component encoding escapes everything reserved (for query values). Full-URL
              encoding keeps <span className="m-inline-code">:/?#[]@!$&amp;&apos;()*+,;=</span> intact.
            </p>
          </div>

          {error && (
            <div className="callout">
              <p>{error}</p>
            </div>
          )}

          <Result label="Component encoded (encodeURIComponent)" value={componentEncoded} />
          <Result label="Full URL encoded (encodeURI)" value={fullEncoded} />
          <Result label="Decoded" value={decoded} />

          <SecurityNote />
        </div>
      </section>
    </div>
  );
}
