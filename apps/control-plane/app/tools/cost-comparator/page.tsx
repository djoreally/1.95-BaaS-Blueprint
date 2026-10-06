/**
 * InvisibleDB — Cost Comparator.
 *
 * One set of usage inputs, four providers, one table. Where a price can't
 * be verified, the cell says "varies" instead of a made-up number.
 */
'use client';

import { useMemo, useState } from 'react';
import {
  SOURCES,
  estimateFirebase,
  estimateInvisibleDb,
  estimatePocketHost,
  estimateSupabase,
  fmtInt,
  fmtMoney,
  mauToSlider,
  sliderToMau,
} from '../pricing';
import ToolCrossLinks from '../ToolCrossLinks';

function Slider(props: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
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
    </div>
  );
}

interface ProviderRow {
  name: string;
  tagline: string;
  monthly: number;
  howPriced: string;
  notes: string;
  notesVaries?: boolean;
}

export default function CostComparatorPage() {
  const [seats, setSeats] = useState(3);
  const [mauSlider, setMauSlider] = useState(mauToSlider(25_000));
  const [readsPerDay, setReadsPerDay] = useState(60);
  const [writesPerDay, setWritesPerDay] = useState(12);
  const [storageGb, setStorageGb] = useState(100);

  const mau = sliderToMau(mauSlider);

  const rows: ProviderRow[] = useMemo(() => {
    const fb = estimateFirebase({
      mau,
      readsPerUserPerDay: readsPerDay,
      writesPerUserPerDay: writesPerDay,
      storageGb,
    });
    const sb = estimateSupabase({ mau, storageGb });
    return [
      {
        name: 'Firebase',
        tagline: 'Blaze pay-as-you-go',
        monthly: fb.total,
        howPriced: 'Per operation: reads, writes, Auth MAUs, storage',
        notes: 'Excludes downloads/egress, deletes, functions — varies',
        notesVaries: true,
      },
      {
        name: 'Supabase',
        tagline: 'Pro plan',
        monthly: sb.total,
        howPriced: `$25/mo base + overages${sb.mauOverage > 0 || sb.storageOverage > 0 ? ' (applied)' : ''}`,
        notes: 'Bandwidth assumed within 250 GB included; compute add-ons — varies',
        notesVaries: true,
      },
      {
        name: 'PocketHost',
        tagline: 'Per seat',
        monthly: estimatePocketHost(seats),
        howPriced: `$9.99 × ${seats} seat${seats === 1 ? '' : 's'}`,
        notes: 'Plan limits and overages not verified — varies',
        notesVaries: true,
      },
      {
        name: 'InvisibleDB',
        tagline: 'Per seat, flat',
        monthly: estimateInvisibleDb(seats),
        howPriced: seats <= 1 ? 'First seat $1' : `First seat $1 + ${seats - 1} × $6.99`,
        notes: 'Flat. Auth, realtime DB, storage, vector search included.',
      },
    ];
  }, [mau, readsPerDay, writesPerDay, storageGb, seats]);

  const cheapest = Math.min(...rows.map((r) => r.monthly));

  return (
    <div className="m-page">
      <style>{`
        .tool-hero { text-align: center; padding: 5rem 1.5rem 3.5rem; max-width: 52rem; margin: 0 auto; }
        .tool-card { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 14px; padding: 1.75rem; margin-bottom: 1.25rem; }
        .input-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 2rem; margin-top: 1.25rem; }
        @media (max-width: 700px) { .input-grid { grid-template-columns: 1fr; } }
        .calc-slider { margin-bottom: 1.5rem; }
        .calc-slider-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; gap: 1rem; }
        .calc-slider-head label { font-size: 0.95rem; font-weight: 600; color: var(--ink); }
        .calc-slider-val { font-size: 1.05rem; font-weight: 800; color: var(--amber); white-space: nowrap; }
        .tool-range { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 999px; background: var(--bg-softer); border: 1px solid var(--line); outline: none; cursor: pointer; }
        .tool-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: var(--amber); cursor: pointer; border: none; }
        .tool-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--amber); cursor: pointer; border: none; }
        .cmp-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.95rem; }
        .cmp-table th { text-align: left; padding: 0.9rem 1rem; color: var(--muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid var(--line); }
        .cmp-table td { padding: 1.1rem 1rem; border-bottom: 1px solid var(--line); vertical-align: top; }
        .cmp-table tr:last-child td { border-bottom: none; }
        .cmp-table .pname { font-weight: 800; font-size: 1.05rem; color: var(--ink); }
        .cmp-table .ptag { display: block; font-size: 0.8rem; font-weight: 400; color: var(--faint); margin-top: 0.15rem; }
        .cmp-table .pmonth { font-weight: 800; font-size: 1.35rem; white-space: nowrap; }
        .cmp-table .pmonth small { font-size: 0.85rem; font-weight: 400; color: var(--muted); }
        .cmp-table .phow { color: var(--muted); font-size: 0.9rem; line-height: 1.55; }
        .cmp-table .pnotes { color: var(--faint); font-size: 0.85rem; line-height: 1.55; }
        .cmp-table tr.winner td { background: var(--amber-dim); }
        .cmp-table tr.winner td:first-child { border-left: 3px solid var(--amber); padding-left: calc(1rem - 3px); }
        .cmp-table tr.winner .pmonth { color: var(--amber); }
        .winner-badge { display: inline-block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--amber); border: 1px solid rgba(245,158,11,0.45); border-radius: 999px; padding: 0.15rem 0.65rem; margin-left: 0.6rem; vertical-align: middle; }
        .cmp-scroll { overflow-x: auto; }
        .cmp-scroll table { min-width: 640px; }
        .src-list { list-style: none; padding: 0; margin: 1rem 0 0; }
        .src-list li { padding: 0.7rem 0; border-bottom: 1px solid var(--line); font-size: 0.92rem; line-height: 1.6; }
        .src-list li:last-child { border-bottom: none; }
        .src-list .asof { display: inline-block; font-size: 0.75rem; font-weight: 700; color: var(--amber); border: 1px solid rgba(245,158,11,0.35); border-radius: 999px; padding: 0.1rem 0.6rem; margin-left: 0.6rem; white-space: nowrap; }
        .src-list p { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.88rem; }
        .fine { font-size: 0.85rem; color: var(--faint); }
        .notes li { margin-bottom: 0.7rem; line-height: 1.65; color: var(--muted); }
        .notes li strong { color: var(--ink); }
      `}</style>

      {/* HERO */}
      <section className="tool-hero">
        <span className="kicker">Tools · Cost Comparator</span>
        <h1>
          Four backends. <span className="hl">One honest table.</span>
        </h1>
        <p className="lede" style={{ margin: '0 auto' }}>
          Same usage, four price tags. Where we can&apos;t verify a number, we say
          so — we don&apos;t invent one.
        </p>
      </section>

      <div className="m-wrap" style={{ maxWidth: '64rem', paddingBottom: '5rem' }}>
        {/* INPUTS */}
        <div className="tool-card">
          <h2 className="h3">Your usage</h2>
          <div className="input-grid">
            <Slider
              label="Seats / backends"
              valueLabel={String(seats)}
              min={1}
              max={20}
              step={1}
              value={seats}
              onChange={setSeats}
            />
            <Slider
              label="Monthly active users"
              valueLabel={fmtInt(mau)}
              min={0}
              max={100}
              step={1}
              value={mauSlider}
              onChange={setMauSlider}
            />
            <Slider
              label="Reads per user per day"
              valueLabel={String(readsPerDay)}
              min={0}
              max={300}
              step={5}
              value={readsPerDay}
              onChange={setReadsPerDay}
            />
            <Slider
              label="Writes per user per day"
              valueLabel={String(writesPerDay)}
              min={0}
              max={60}
              step={1}
              value={writesPerDay}
              onChange={setWritesPerDay}
            />
            <Slider
              label="File storage"
              valueLabel={`${fmtInt(storageGb)} GB`}
              min={0}
              max={1000}
              step={10}
              value={storageGb}
              onChange={setStorageGb}
            />
          </div>
          <p className="fine" style={{ marginBottom: 0 }}>
            Firebase bills per operation; Supabase bills per plan plus overages; PocketHost
            and InvisibleDB bill per seat. The table below applies each provider&apos;s
            actual pricing model to the same numbers.
          </p>
        </div>

        {/* TABLE */}
        <div className="tool-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="cmp-scroll">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Monthly estimate</th>
                  <th>How it&apos;s priced</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isWinner = r.monthly === cheapest;
                  return (
                    <tr key={r.name} className={isWinner ? 'winner' : undefined}>
                      <td>
                        <span className="pname">
                          {r.name}
                          {isWinner && <span className="winner-badge">Lowest</span>}
                        </span>
                        <span className="ptag">{r.tagline}</span>
                      </td>
                      <td>
                        <span className="pmonth">
                          {fmtMoney(r.monthly)}
                          <small>/mo</small>
                        </span>
                      </td>
                      <td className="phow">{r.howPriced}</td>
                      <td className="pnotes">{r.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* WHAT THE TABLE LEAVES OUT */}
        <div className="tool-card">
          <h2 className="h3">What the table leaves out</h2>
          <ul className="notes" style={{ paddingLeft: '1.2rem', marginTop: '1rem' }}>
            <li>
              <strong>Firebase egress is not modeled.</strong> Downloads, function egress,
              and CDN transfer bill separately ($0.12 / GB on legacy buckets) and are the
              most common surprise line items. Treat the Firebase row as a floor.
            </li>
            <li>
              <strong>Supabase bandwidth is assumed inside the 250 GB quota.</strong>{' '}
              Beyond that it&apos;s $0.09 / GB — media-heavy apps get there fast. Compute
              add-ons (Micro is included; Small and up are not) and realtime/edge-function
              overages are not modeled.
            </li>
            <li>
              <strong>PocketHost plan limits aren&apos;t public in a form we could verify.</strong>{' '}
              The $9.99 / seat rate is the figure we were given; what happens past plan
              limits is marked varies rather than guessed.
            </li>
            <li>
              <strong>Supabase counts a real Postgres database</strong> — no per-row
              operation charges, which is why reads/writes don&apos;t move its number.
              That&apos;s a genuine architectural advantage at high operation volume.
            </li>
            <li>
              <strong>InvisibleDB&apos;s number is the whole bill.</strong> One seat covers
              auth, realtime database, file storage, admin UI, and vector search — the
              database file itself is yours to keep.
            </li>
          </ul>
        </div>

        {/* SOURCES */}
        <div className="tool-card">
          <h2 className="h3">Pricing sources</h2>
          <ul className="src-list">
            {SOURCES.map((s) => (
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
          <h2 className="h3">What these numbers are — and aren&apos;t</h2>
          <p className="fine" style={{ color: 'var(--muted)', marginBottom: 0, lineHeight: 1.7 }}>
            Estimates from public list prices, not quotes. Firebase rows use Standard
            edition us-central1 rates and exclude egress, deletes, functions, SMS, and
            multi-region uplifts. Supabase rows assume the Pro plan with usage inside the
            250 GB bandwidth quota and no compute upgrades. PocketHost limits and overages
            are unverified. Actual bills vary by region, usage pattern, and discounts —
            and any provider can change prices at any time.
          </p>
        </div>

        <ToolCrossLinks current="/tools/cost-comparator" />

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <a className="m-btn" href="/signup">
            Skip the spreadsheet — first seat $1
          </a>
        </div>
      </div>
    </div>
  );
}
