'use client';

import { useCallback, useEffect, useState } from 'react';

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
const arr = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(obj(data).error || `Request failed (${response.status})`));
  return data;
}

export default function VectorManager({ slug }: { slug: string }) {
  const dataUrl = `/api/projects/${encodeURIComponent(slug)}/data`;
  const [status, setStatus] = useState<Obj[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [collection, setCollection] = useState('');
  const [recordId, setRecordId] = useState('');
  const [embedding, setEmbedding] = useState('');
  const [output, setOutput] = useState('');

  const load = useCallback(async () => {
    try {
      const [vectorData, collectionData] = await Promise.all([
        request(`${dataUrl}?resource=vector`),
        request(`${dataUrl}?resource=collections`),
      ]);
      setStatus(arr(obj(vectorData).collections).map(obj));
      const names = arr(obj(collectionData).items).map((item) => String(obj(item).name || '')).filter(Boolean);
      setCollections(names);
      if (!collection && names[0]) setCollection(names[0]);
      setOutput('');
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'Failed to load vector state');
    }
  }, [dataUrl, collection]);

  useEffect(() => { void load(); }, [load]);

  function parseVector() {
    const parsed = JSON.parse(embedding) as unknown;
    if (!Array.isArray(parsed) || !parsed.length || !parsed.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error('Embedding must be a JSON array of finite numbers.');
    }
    return parsed as number[];
  }

  async function action(name: 'vector.upsert' | 'vector.delete' | 'vector.query') {
    try {
      const body: Obj = { action: name, collection };
      if (name !== 'vector.query') body.id = recordId;
      if (name !== 'vector.delete') body.embedding = parseVector();
      if (name === 'vector.query') body.limit = 10;
      const data = await request(dataUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      setOutput(JSON.stringify(data, null, 2));
      if (name !== 'vector.query') await load();
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'Vector action failed');
    }
  }

  return <>
    <section className="card" style={{ marginBottom: 14 }}>
      <h2 style={{ marginTop: 0 }}>Vector indexes</h2>
      {status.length ? status.map((item) => <div key={String(item.collection)} style={{ borderBottom: '1px solid #222', padding: '10px 0', display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{String(item.collection)}</strong><span style={{ color: '#888' }}>{String(item.dimensions)} dimensions</span></div>) : <p style={{ color: '#888' }}>No vector collection has been initialized yet. The first upsert creates it and locks its dimensions.</p>}
    </section>

    <section className="card" style={{ marginBottom: 14 }}>
      <h2 style={{ marginTop: 0 }}>Index a record</h2>
      <p style={{ color: '#999' }}>Vectors are attached to existing PocketBase records. Changing dimensions requires a new vector collection; we do not mutate dimensions in place.</p>
      <div style={{ display: 'grid', gap: 10, maxWidth: 700 }}>
        <select value={collection} onChange={(e) => setCollection(e.target.value)}>{collections.map((name) => <option key={name} value={name}>{name}</option>)}</select>
        <input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="Record ID" />
        <textarea value={embedding} onChange={(e) => setEmbedding(e.target.value)} rows={6} placeholder="Embedding JSON, e.g. [0.12, -0.4, 0.91]" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn" onClick={() => void action('vector.upsert')}>Upsert vector</button><button onClick={() => void action('vector.delete')}>Delete vector</button></div>
      </div>
    </section>

    <section className="card">
      <h2 style={{ marginTop: 0 }}>Similarity query</h2>
      <p style={{ color: '#999' }}>Queries hydrate the matching PocketBase records and apply their normal View rules before results are returned.</p>
      <button className="btn" onClick={() => void action('vector.query')}>Run top-10 query</button>
      {output ? <pre style={{ marginTop: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 500, overflow: 'auto' }}>{output}</pre> : null}
    </section>
  </>;
}
