'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * InvisibleDB 30-second demo — voiceover + synchronized product animation.
 * Audio: /demo-voiceover.mp3 (~34s). Scenes advance on a fixed timeline.
 */

const SCENES = [
  { at: 0, id: 'terminal' },
  { at: 6, id: 'dashboard' },
  { at: 13, id: 'code' },
  { at: 21, id: 'zeroai' },
  { at: 29, id: 'endcard' },
];

const TERMINAL_LINES = [
  '$ idb init',
  '✓ Backend provisioned',
  '  → demo.invisibledb.app ● LIVE',
];

const CODE_LINES = [
  "import { InvisibleDB } from 'invisibledb';",
  '',
  'const db = new InvisibleDB({',
  "  baseUrl: 'https://demo.invisibledb.app',",
  "  apiKey: 'idb_live_···',",
  '});',
  '',
  'await db.auth.signIn(email, password);',
  'db.collection("notes").subscribe(render);',
  '',
  '// → 200 OK · realtime connected',
];

const PLANES = ['Memory', 'Ledger', 'Policy', 'Gates'];

export default function DemoPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [scene, setScene] = useState(0);
  const [typedTerm, setTypedTerm] = useState(0);
  const [typedCode, setTypedCode] = useState(0);
  const [planesOn, setPlanesOn] = useState(0);
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
    // scene switches
    SCENES.forEach((s, i) => later(s.at * 1000, () => setScene(i)));
    // terminal typing: 3 lines over ~5s
    TERMINAL_LINES.forEach((_, i) => later(800 + i * 1400, () => setTypedTerm(i + 1)));
    // code typing: 11 lines over ~7s
    CODE_LINES.forEach((_, i) => later(13500 + i * 550, () => setTypedCode(i + 1)));
    // zeroai planes: 4 cards over ~6s
    PLANES.forEach((_, i) => later(21500 + i * 1300, () => setPlanesOn(i + 1)));
  }, []);

  const reset = () => {
    setScene(0);
    setTypedTerm(0);
    setTypedCode(0);
    setPlanesOn(0);
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

  return (
    <div className="demo-shell">
      <style>{`
        .demo-shell { position: relative; border: 1px solid #232327; border-radius: 16px; overflow: hidden; background: #0a0a0b; aspect-ratio: 16/9; max-width: 880px; margin: 0 auto; }
        .demo-scene { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; opacity: 0; transition: opacity .6s ease; pointer-events: none; }
        .demo-scene.on { opacity: 1; pointer-events: auto; }
        .demo-term { width: 100%; max-width: 560px; background: #131316; border: 1px solid #232327; border-radius: 12px; padding: 1.25rem 1.5rem; font-family: ui-monospace, monospace; font-size: .95rem; line-height: 1.9; color: #f4f4f5; text-align: left; }
        .demo-term .ok { color: #f59e0b; }
        .demo-term .dim { color: #71717a; }
        .demo-cursor { display: inline-block; width: .6em; height: 1.1em; background: #f59e0b; vertical-align: -0.15em; animation: blink 1s steps(1) infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .demo-dash { width: 100%; max-width: 560px; background: #131316; border: 1px solid #232327; border-radius: 12px; padding: 1.5rem; text-align: left; }
        .demo-dash .row { display: flex; justify-content: space-between; align-items: center; padding: .6rem 0; border-bottom: 1px solid #232327; font-size: .95rem; }
        .demo-dash .row:last-child { border: none; }
        .demo-live { color: #f59e0b; font-weight: 700; }
        .demo-key { font-family: ui-monospace, monospace; background: #0a0a0b; border: 1px solid #232327; padding: .25rem .6rem; border-radius: 6px; font-size: .85rem; }
        .demo-code { width: 100%; max-width: 560px; background: #131316; border: 1px solid #232327; border-radius: 12px; padding: 1.25rem 1.5rem; font-family: ui-monospace, monospace; font-size: .82rem; line-height: 1.7; color: #d4d4d8; text-align: left; white-space: pre-wrap; min-height: 220px; }
        .demo-code .cm { color: #71717a; }
        .demo-planes { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; width: 100%; max-width: 520px; }
        .demo-plane { background: #131316; border: 1px solid #f59e0b; border-radius: 12px; padding: 1.25rem; text-align: center; opacity: 0; transform: translateY(12px); transition: all .5s ease; }
        .demo-plane.on { opacity: 1; transform: none; }
        .demo-plane h4 { margin: 0 0 .25rem; color: #f59e0b; font-size: 1.05rem; }
        .demo-plane p { margin: 0; color: #a1a1aa; font-size: .8rem; }
        .demo-end h3 { font-size: clamp(2rem, 5vw, 3rem); margin: 0 0 .5rem; letter-spacing: -0.02em; color: #f4f4f5; }
        .demo-end h3 .hl { color: #f59e0b; }
        .demo-end p { color: #a1a1aa; margin: 0 0 1.5rem; }
        .demo-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; background: rgba(10,10,11,.72); z-index: 5; cursor: pointer; border: none; width: 100%; color: #f4f4f5; }
        .demo-play { width: 84px; height: 84px; border-radius: 50%; background: #f59e0b; color: #0a0a0b; font-size: 2rem; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; }
        .demo-stop { position: absolute; top: 1rem; right: 1rem; z-index: 6; background: rgba(19,19,22,.85); border: 1px solid #232327; color: #f4f4f5; border-radius: 8px; padding: .4rem .8rem; font-size: .8rem; cursor: pointer; }
        .demo-bar { position: absolute; bottom: 0; left: 0; height: 3px; background: #f59e0b; z-index: 6; transition: width .3s linear; }
      `}</style>

      <audio ref={audioRef} src="/demo-voiceover.mp3" preload="auto" />

      {!playing && !ended && (
        <button className="demo-overlay" onClick={play} aria-label="Play the 30-second demo">
          <span className="demo-play">▶</span>
          <span style={{ fontWeight: 600 }}>Watch the 34-second demo</span>
          <span style={{ color: '#a1a1aa', fontSize: '.9rem' }}>with voiceover</span>
        </button>
      )}

      {playing && (
        <button className="demo-stop" onClick={stop}>⏸ Pause</button>
      )}

      {ended && (
        <button className="demo-overlay" onClick={play} aria-label="Replay the demo">
          <span className="demo-play">↻</span>
          <span style={{ fontWeight: 600 }}>Replay</span>
          <a href="/signup" onClick={(e) => e.stopPropagation()} style={{ marginTop: '.5rem', background: '#f59e0b', color: '#0a0a0b', padding: '.7rem 1.6rem', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>Get started — first month $1</a>
        </button>
      )}

      {/* Scene 0: terminal */}
      <div className={`demo-scene ${scene === 0 && playing ? 'on' : ''}`}>
        <div className="demo-term">
          {TERMINAL_LINES.slice(0, typedTerm).map((l, i) => (
            <div key={i} className={l.startsWith('✓') || l.includes('●') ? 'ok' : l.startsWith('$') ? '' : 'dim'}>{l}</div>
          ))}
          <span className="demo-cursor" />
        </div>
      </div>

      {/* Scene 1: dashboard */}
      <div className={`demo-scene ${scene === 1 && playing ? 'on' : ''}`}>
        <div className="demo-dash">
          <div className="row"><span><strong>demo</strong> <span className="dim">· invisibledb.app</span></span><span className="demo-live">● LIVE</span></div>
          <div className="row"><span className="dim">API key</span><span className="demo-key">idb_live_9f2k…</span></div>
          <div className="row"><span className="dim">Plan</span><span>$6.99/mo · first month $1</span></div>
        </div>
      </div>

      {/* Scene 2: code */}
      <div className={`demo-scene ${scene === 2 && playing ? 'on' : ''}`}>
        <div className="demo-code">
          {CODE_LINES.slice(0, typedCode).map((l, i) => (
            <div key={i} className={l.startsWith('//') ? 'cm' : ''}>{l || ' '}</div>
          ))}
        </div>
      </div>

      {/* Scene 3: zeroai */}
      <div className={`demo-scene ${scene === 3 && playing ? 'on' : ''}`}>
        <p style={{ color: '#a1a1aa', margin: '0 0 1.25rem' }}>Every seat ships the <strong style={{ color: '#f4f4f5' }}>ZeroAI agent OS</strong></p>
        <div className="demo-planes">
          {PLANES.map((p, i) => (
            <div key={p} className={`demo-plane ${planesOn > i ? 'on' : ''}`}>
              <h4>{p}</h4>
              <p>{['Agents remember across sessions', 'Tamper-evident action log', 'Agents can\'t grant themselves power', 'Deterministic release checks'][i]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scene 4: end card */}
      <div className={`demo-scene demo-end ${scene === 4 && playing ? 'on' : ''}`}>
        <h3>Invisible<span className="hl">DB</span></h3>
        <p>Every backend your app needs. None of the ops.</p>
      </div>
    </div>
  );
}
