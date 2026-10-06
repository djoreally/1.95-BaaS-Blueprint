/**
 * InvisibleDB — UUID Generator.
 *
 * Bulk UUID v4 via crypto.randomUUID. 1–100 at a time.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRow, SecurityNote, ToolHero } from '../components';

export default function UuidGeneratorPage() {
  const [count, setCount] = useState(10);
  const [uuids, setUuids] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);

  const regenerate = useCallback(() => {
    setUuids(Array.from({ length: count }, () => crypto.randomUUID()));
  }, [count]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(uuids.join('\n'));
    } catch {
      /* clipboard unavailable */
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  return (
    <div className="m-page">
      <ToolHero
        kicker="Developer tools"
        title={<>UUID <span className="hl">Generator</span></>}
        lede="Bulk UUID v4, generated with crypto.randomUUID. Database keys, idempotency tokens, correlation IDs."
      />

      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap" style={{ maxWidth: '56rem' }}>
          <div className="m-card" style={{ marginBottom: '1.5rem' }}>
            <div className="field">
              <label>How many: {count}</label>
              <input
                type="range"
                className="tool-range"
                min={1}
                max={100}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                aria-label="Number of UUIDs"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button type="button" className="m-btn" onClick={regenerate}>
                Regenerate
              </button>
              <button type="button" className="m-btn ghost" onClick={copyAll}>
                {copiedAll ? 'Copied all ✓' : 'Copy all'}
              </button>
            </div>
          </div>

          <div style={{ maxHeight: '28rem', overflowY: 'auto' }}>
            {uuids.map((u) => (
              <KeyRow key={u} value={u} />
            ))}
          </div>

          <SecurityNote />
        </div>
      </section>
    </div>
  );
}
