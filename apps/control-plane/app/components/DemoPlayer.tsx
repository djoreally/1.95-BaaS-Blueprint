'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * "What is InvisibleDB?" — narrated explainer.
 * Audio: /demo-voiceover.mp3 (~68s). Scenes advance on a fixed timeline.
 * Cover: /explainer-cover.jpg
 */

const SCENES = [
  { at: 0, id: 'who' },
  { at: 12, id: 'what' },
  { at: 24, id: 'why' },
  { at: 36, id: 'get' },
  { at: 54, id: 'data' },
  { at: 60, id: 'how' },
];

const WHO = [
  ['Indie developers', 'Shipping solo or small-team'],
  ['Web apps', 'React, Next.js, Vue'],
  ['Mobile apps', 'Dart-first, REST for all'],
  ['AI features', 'Vector search built in'],
];

const WHAT = [
  ['Auth', 'Email, OAuth, tokens'],
  ['Realtime DB', 'Subscribe, sync, done'],
  ['File storage', 'Uploads handled'],
  ['Vector search', 'AI-native, no add-on'],
];

const PLANES = [
  ['Memory', 'Agents learn across sessions'],
  ['Ledger', 'Tamper-evident action log'],
  ['Policy', "Agents can't grant themselves power"],
  ['Gates', 'Deterministic release checks'],
];

export default function DemoPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [scene, setScene] = useState(0);
  const [cards, setCards] = useState(0);
  const [ended, setEnded] = useState(false);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const runTimeline = useCallback(() => {
    clear();
    SCENES.forEach((s, i) => later(s.at * 1000, () => { setScene(i); setCards(0); }));
    // card reveals per scene: who(0-12), what(12-24), get(36-54)
    WHO.forEach((_, i) => later(1500 + i * 2200, () => { setScene(0); setCards(i + 1); }));
    WHAT.forEach((_, i) => later(13500 + i * 2200, () => { setScene(1); setCards(i + 1); }));
    PLANES.forEach((_, i) => later(37500 + i * 3400, () => { setScene(3); setCards(i + 1); }));
  }, []);

  const reset = () => {
    setScene(0);
    setCards(0);
    setEnded(false);
  };

  const play = () => {
    const a = audioRef.current;
    if (!a) return;
    reset();
    setPlaying(true);
    setEnded(false);
    a.currentTime = 0;
    a.play().catch(() => setPlaying(false));
    runTimeline();
  };

  const stop = () => {
    audioRef.current?.pause();
    clear();
    setPlaying(false);
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => {
      setPlaying(false);
      setEnded(true);
      clear();
    };
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('ended', onEnd);
      clear();
    };
  }, []);

  const grid = (items: string[][], n: number) => (
    <div className="demo-grid">
      {items.map(([t, d], i) => (
        <div key={t} className={`demo-card ${n > i ? 'on' : ''}`}>
          <h4>{t}</h4>
          <p>{d}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="demo-shell">
      <style>{`
        .demo-shell { position: relative; border: 1px solid #232327; border-radius: 16px; overflow: hidden; background: #0a0a0b; aspect-ratio: 16/9; max-width: 880px; margin: 0 auto; }
        .demo-scene { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; opacity: 0; transition: opacity .6s ease; pointer-events: none; }
        .demo-scene.on { opacity: 1; pointer-events: auto; }
        .demo-k { color: #f59e0b; font-size: .8rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: .75rem; }
        .demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .9rem; width: 100%; max-width: 560px; }
        .demo-card { background: #131316; border: 1px solid #232327; border-radius: 12px; padding: 1.1rem 1.25rem; text-align: left; opacity: 0; transform: translateY(12px); transition: all .5s ease; }
        .demo-card.on { opacity: 1; transform: none; border-color: #f59e0b; }
        .demo-card h4 { margin: 0 0 .25rem; color: #f4f4f5; font-size: 1rem; }
        .demo-card p { margin: 0; color: #a1a1aa; font-size: .82rem; }
        .demo-bill { width: 100%; max-width: 520px; }
        .demo-bill .row { display: flex; justify-content: space-between; align-items: center; background: #131316; border: 1px solid #232327; border-radius: 10px; padding: .9rem 1.25rem; margin-bottom: .7rem; font-size: .95rem; }
        .demo-bill .bad { color: #f87171; font-weight: 700; }
        .demo-bill .good { color: #f59e0b; font-weight: 700; }
        .demo-file { background: #131316; border: 1px solid #f59e0b; border-radius: 12px; padding: 1.5rem 2rem; text-align: center; }
        .demo-file .fn { font-family: ui-monospace, monospace; color: #f59e0b; font-size: 1.1rem; }
        .demo-file p { color: #a1a1aa; margin: .5rem 0 0; font-size: .9rem; }
        .demo-end h3 { font-size: clamp(2rem, 5vw, 3rem); margin: 0 0 .5rem; letter-spacing: -0.02em; color: #f4f4f5; }
        .demo-end h3 .hl { color: #f59e0b; }
        .demo-end p { color: #a1a1aa; margin: 0 0 1.25rem; }
        .demo-steps { display: flex; gap: .75rem; margin-bottom: 1.5rem; }
        .demo-steps span { background: #131316; border: 1px solid #232327; border-radius: 999px; padding: .45rem 1.1rem; font-size: .85rem; color: #d4d4d8; }
        .demo-steps span b { color: #f59e0b; margin-right: .4rem; }
        .demo-overlay { position: absolute; inset: 0; z-index: 5; cursor: pointer; border: none; width: 100%; padding: 0; background: #0a0a0b; }
        .demo-overlay img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .demo-veil { position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,10,11,.88) 0%, rgba(10,10,11,.25) 55%, rgba(10,10,11,.45) 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .8rem; color: #f4f4f5; }
        .demo-veil h3 { margin: 0; font-size: clamp(1.5rem, 4vw, 2.4rem); letter-spacing: -0.02em; }
        .demo-veil h3 .hl { color: #f59e0b; }
        .demo-veil .sub { color: #d4d4d8; font-size: 1rem; }
        .demo-play { width: 84px; height: 84px; border-radius: 50%; background: #f59e0b; color: #0a0a0b; font-size: 2rem; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; margin-top: .5rem; }
        .demo-stop { position: absolute; top: 1rem; right: 1rem; z-index: 6; background: rgba(19,19,22,.85); border: 1px solid #232327; color: #f4f4f5; border-radius: 8px; padding: .4rem .8rem; font-size: .8rem; cursor: pointer; }
        .demo-cta { margin-top: .5rem; background: #f59e0b; color: #0a0a0b; padding: .7rem 1.6rem; border-radius: 10px; font-weight: 700; text-decoration: none; }
      `}</style>

      <audio ref={audioRef} src="/demo-voiceover.mp3" preload="auto" />

      {!playing && !ended && (
        <button className="demo-overlay" onClick={play} aria-label="Watch the InvisibleDB explainer">
          <img src="/explainer-cover.jpg" alt="What is InvisibleDB?" />
          <span className="demo-veil">
            <h3>What is <span className="hl">InvisibleDB?</span></h3>
            <span className="sub">The 60-second explainer — who it&rsquo;s for, what you get, why it exists</span>
            <span className="demo-play">▶</span>
          </span>
        </button>
      )}

      {playing && (
        <button className="demo-stop" onClick={stop}>⏸ Pause</button>
      )}

      {ended && (
        <button className="demo-overlay" onClick={play} aria-label="Replay the explainer">
          <img src="/explainer-cover.jpg" alt="" />
          <span className="demo-veil">
            <span className="demo-play">↻</span>
            <span style={{ fontWeight: 600 }}>Replay the explainer</span>
            <a href="/signup" onClick={(e) => e.stopPropagation()} className="demo-cta">Get started — first month $1</a>
          </span>
        </button>
      )}

      {/* WHO */}
      <div className={`demo-scene ${scene === 0 && playing ? 'on' : ''}`}>
        <div className="demo-k">Who it&rsquo;s for</div>
        {grid(WHO, cards)}
      </div>

      {/* WHAT */}
      <div className={`demo-scene ${scene === 1 && playing ? 'on' : ''}`}>
        <div className="demo-k">What it is</div>
        {grid(WHAT, cards)}
        <p style={{ color: '#a1a1aa', margin: '1rem 0 0', fontSize: '.9rem' }}>One SDK — JavaScript, Dart, or plain REST</p>
      </div>

      {/* WHY */}
      <div className={`demo-scene ${scene === 2 && playing ? 'on' : ''}`}>
        <div className="demo-k">Why it exists</div>
        <div className="demo-bill">
          <div className="row"><span>Metered backends, after traction</span><span className="bad">$500+/mo</span></div>
          <div className="row"><span>PocketBase hosting, per backend</span><span className="bad">$9.99/mo · no AI story</span></div>
          <div className="row"><span>InvisibleDB, flat</span><span className="good">$6.99/mo · first month $1</span></div>
        </div>
      </div>

      {/* WHAT YOU GET */}
      <div className={`demo-scene ${scene === 3 && playing ? 'on' : ''}`}>
        <div className="demo-k">What you get — the ZeroAI agent OS</div>
        {grid(PLANES, cards)}
      </div>

      {/* DATA */}
      <div className={`demo-scene ${scene === 4 && playing ? 'on' : ''}`}>
        <div className="demo-k">Your data</div>
        <div className="demo-file">
          <div className="fn">◈ your-app.sqlite</div>
          <p>Yours. Take it anywhere — including away from us.</p>
        </div>
      </div>

      {/* HOW */}
      <div className={`demo-scene demo-end ${scene === 5 && playing ? 'on' : ''}`}>
        <div className="demo-k">How you start</div>
        <div className="demo-steps">
          <span><b>1</b>Sign up</span>
          <span><b>2</b>Grab API keys</span>
          <span><b>3</b>Ship</span>
        </div>
        <h3>Invisible<span className="hl">DB</span></h3>
        <p>Every backend your app needs. None of the ops.</p>
      </div>
    </div>
  );
}
