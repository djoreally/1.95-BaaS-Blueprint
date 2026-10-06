/**
 * InvisibleDB — Firebase Bill Calculator.
 *
 * Sliders in, an honest Firebase estimate out, side-by-side with the
 * InvisibleDB flat price. Every rate is sourced; the page says exactly
 * what is and isn't modeled.
 */
'use client';

import { useMemo, useState } from 'react';
import {
  SOURCES,
  estimateFirebase,
  estimateInvisibleDb,
  fmtCompact,
  fmtInt,
  fmtMoney,
  mauToSlider,
  sliderToMau,
} from '../pricing';

const FIREBASE_SOURCES = SOURCES.slice(0, 4);

function Slider(props: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="calc-slider">
      <div className="calc-slider-head">
        <label>{props.label}</label>
        <span className="calc-slider-val">{props.valueLabel}</span>
      </div>
      <input
        type="range"
        className="tool-range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        aria-label={props.label}
      />
      {props.hint && <p className="calc-hint">{props.hint}</p>}
    </div>
  );
}

export default function FirebaseBillCalculatorPage() {
  const [mauSlider, setMauSlider] = useState(mauToSlider(25_000));
  const [readsPerDay, setReadsPerDay] = useState(60);
  const [writesPerDay, setWritesPerDay] = useState(12);
  const [storageGb, setStorageGb] = useState(100);
  const [copied, setCopied] = useState(false);

  const mau = sliderToMau(mauSlider);

  const estimate = useMemo(
    () =>
      estimateFirebase({
        mau,
        readsPerUserPerDay: readsPerDay,
        writesPerUserPerDay: writesPerDay,
        storageGb,
      }),
    [mau, readsPerDay, writesPerDay, storageGb],
  );

  const idb = estimateInvisibleDb(1);
  const savings = estimate.total - idb;

  const shareText = () => {
    const line1 = `My Firebase estimate: ${fmtMoney(estimate.total)}/mo for ${fmtInt(
      mau,
    )} MAU (${readsPerDay} reads/user/day, ${writesPerDay} writes/user/day, ${fmtInt(
      storageGb,
    )} GB storage).`;
    const line2 =
      savings > 0
        ? `InvisibleDB: ${fmtMoney(idb)}/mo flat — keeps ${fmtMoney(savings)}/mo in my pocket.`
        : `InvisibleDB: ${fmtMoney(idb)}/mo flat. At this scale Firebase's free tier wins — the math says so.`;
    return `${line1} ${line2} Estimate from public list prices as of Oct 2026. Check the math: ${
      typeof window !== 'undefined' ? window.location.href : ''
    }`;
  };

  const copyShare = async () => {
    const text = shareText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="m-page">
      <style>{`
        .tool-hero { text-align: center; padding: 5rem 1.5rem 3.5rem; max-width: 52rem; margin: 0 auto; }
        .tool-card { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 14px; padding: 1.75rem; margin-bottom: 1.25rem; }
        .calc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        @media (max-width: 760px) { .calc-grid { grid-template-columns: 1fr; } }
        .calc-slider { margin-bottom: 1.5rem; }
        .calc-slider:last-child { margin-bottom: 0; }
        .calc-slider-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; gap: 1rem; }
        .calc-slider-head label { font-size: 0.95rem; font-weight: 600; color: var(--ink); }
        .calc-slider-val { font-size: 1.05rem; font-weight: 800; color: var(--amber); white-space: nowrap; }
        .calc-hint { font-size: 0.82rem; color: var(--faint); margin: 0.35rem 0 0; }
        .tool-range { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 999px; background: var(--bg-softer); border: 1px solid var(--line); outline: none; cursor: pointer; }
        .tool-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: var(--amber); cursor: pointer; border: none; }
        .tool-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--amber); cursor: pointer; border: none; }
        .breakdown .row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.85rem 0; border-bottom: 1px solid var(--line); align-items: baseline; }
        .breakdown .row:last-of-type { border-bottom: none; }
        .breakdown .label { color: var(--ink); font-weight: 600; font-size: 0.98rem; }
        .breakdown .detail { display: block; color: var(--faint); font-weight: 400; font-size: 0.82rem; margin-top: 0.15rem; }
        .breakdown .value { font-weight: 800; white-space: nowrap; font-size: 1.05rem; }
        .versus { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: stretch; margin: 2rem 0 0; }
        @media (max-width: 640px) { .versus { grid-template-columns: 1fr; } .versus .vs { display: none; } }
        .versus .card { border-radius: 16px; padding: 2rem 1.5rem; text-align: center; border: 1px solid var(--line); background: var(--bg-soft); }
        .versus .card .cap { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 0.75rem; }
        .versus .num { font-size: clamp(2.2rem, 5vw, 3.4rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
        .versus .num small { font-size: 1rem; font-weight: 400; color: var(--muted); }
        .versus .bad .num { color: var(--red); }
        .versus .good { border-color: rgba(245,158,11,0.45); background: var(--amber-dim); }
        .versus .good .num { color: var(--amber); }
        .versus .vs { align-self: center; font-weight: 800; color: var(--faint); font-size: 1.1rem; }
        .savings-line { text-align: center; margin-top: 1.75rem; font-size: 1.15rem; }
        .savings-line strong { color: var(--amber); }
        .share-row { display: flex; justify-content: center; margin-top: 1.5rem; }
        .src-list { list-style: none; padding: 0; margin: 1rem 0 0; }
        .src-list li { padding: 0.7rem 0; border-bottom: 1px solid var(--line); font-size: 0.92rem; line-height: 1.6; }
        .src-list li:last-child { border-bottom: none; }
        .src-list .asof { display: inline-block; font-size: 0.75rem; font-weight: 700; color: var(--amber); border: 1px solid rgba(245,158,11,0.35); border-radius: 999px; padding: 0.1rem 0.6rem; margin-left: 0.6rem; white-space: nowrap; }
        .src-list p { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.88rem; }
        .fine { font-size: 0.85rem; color: var(--faint); }
      `}</style>

      {/* HERO */}
      <section className="tool-hero">
        <span className="kicker">Tools · Firebase Bill Calculator</span>
        <h1>
          Your Firebase bill, <span className="hl">before it arrives.</span>
        </h1>
        <p className="lede" style={{ margin: '0 auto' }}>
          Drag the sliders to match your app. We&apos;ll do the Firebase math from public
          list prices — then show you the other option.
        </p>
      </section>

      <div className="m-wrap" style={{ maxWidth: '60rem', paddingBottom: '5rem' }}>
        {/* INPUTS + BREAKDOWN */}
        <div className="calc-grid">
          <div className="tool-card">
            <h3>Your app</h3>
            <div style={{ marginTop: '1.25rem' }}>
              <Slider
                label="Monthly active users"
                valueLabel={fmtInt(mau)}
                min={0}
                max={100}
                step={1}
                value={mauSlider}
                onChange={setMauSlider}
                hint="Logarithmic scale, 1K to 500K."
              />
              <Slider
                label="Firestore reads per user per day"
                valueLabel={String(readsPerDay)}
                min={0}
                max={300}
                step={5}
                value={readsPerDay}
                onChange={setReadsPerDay}
                hint="Every document fetched counts. A feed screen can easily pull 30–80."
              />
              <Slider
                label="Firestore writes per user per day"
                valueLabel={String(writesPerDay)}
                min={0}
                max={60}
                step={1}
                value={writesPerDay}
                onChange={setWritesPerDay}
                hint="Posts, likes, profile edits — each is a billed write."
              />
              <Slider
                label="File storage"
                valueLabel={`${fmtInt(storageGb)} GB`}
                min={0}
                max={1000}
                step={10}
                value={storageGb}
                onChange={setStorageGb}
                hint="User uploads, images, backups."
              />
            </div>
          </div>

          <div className="tool-card">
            <h3>The Firebase math</h3>
            <div className="breakdown" style={{ marginTop: '1rem' }}>
              {estimate.lines.map((l) => (
                <div className="row" key={l.label}>
                  <span className="label">
                    {l.label}
                    <span className="detail">{l.detail}</span>
                  </span>
                  <span className="value">{fmtMoney(l.cost)}</span>
                </div>
              ))}
            </div>
            <p className="fine" style={{ marginTop: '1rem', marginBottom: 0 }}>
              Monthly totals from daily usage × 30. Free tiers applied first, exactly like
              the Blaze plan does.
            </p>
          </div>
        </div>

        {/* VERSUS */}
        <div className="versus">
          <div className="card bad">
            <div className="cap">Firebase · estimated</div>
            <div className="num">
              {fmtMoney(estimate.total)}
              <small>/mo</small>
            </div>
          </div>
          <div className="vs">vs</div>
          <div className="card good">
            <div className="cap">InvisibleDB · flat</div>
            <div className="num">
              {fmtMoney(idb)}
              <small>/mo</small>
            </div>
          </div>
        </div>

        <p className="savings-line">
          {savings > 0 ? (
            <>
              That&apos;s <strong>{fmtMoney(savings)}/mo</strong> —{' '}
              <strong>{fmtMoney(savings * 12)}/year</strong> — back in your pocket.
            </>
          ) : savings < 0 ? (
            <>
              At this scale, Firebase&apos;s free tier genuinely wins —{' '}
              <strong>{fmtMoney(-savings)}/mo</strong> cheaper. The math says so, and
              we&apos;re not going to argue with it.
            </>
          ) : (
            <>Dead even. Pick whoever you like more.</>
          )}
        </p>

        <div className="share-row">
          <button className="btn secondary" onClick={copyShare}>
            {copied ? 'Copied — paste it anywhere ✓' : '⧉ Share this result'}
          </button>
        </div>

        {/* SOURCES */}
        <div className="tool-card" style={{ marginTop: '2.5rem' }}>
          <h3>Pricing sources</h3>
          <ul className="src-list">
            {FIREBASE_SOURCES.map((s) => (
              <li key={s.label}>
                <strong>{s.label}</strong>
                <span className="asof">as of {s.asOf}</span>
                <p>
                  {s.detail}{' '}
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      Source ↗
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* DISCLAIMER */}
        <div
          className="tool-card"
          style={{ borderColor: 'rgba(245,158,11,0.45)', background: 'var(--amber-dim)' }}
        >
          <h3>What this estimate is — and isn&apos;t</h3>
          <p className="fine" style={{ color: 'var(--muted)', marginBottom: 0, lineHeight: 1.7 }}>
            This is an estimate from public list prices, not a quote. It models Firestore
            document reads/writes, Auth MAUs, and file storage only. It does <em>not</em>{' '}
            include downloads/egress, deletes, Cloud Functions, phone-auth SMS, the new{' '}
            <code className="m-inline-code">*.firebasestorage.app</code> bucket rates, or
            multi-region uplifts — all of which push real bills higher. Firestore prices
            shown are Standard edition, us-central1; other regions differ. Your actual
            bill depends on usage patterns, and Google can change prices at any time.
          </p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <a className="m-btn" href="/signup">
            One flat price instead — first seat $1
          </a>
        </div>
      </div>
    </div>
  );
}
