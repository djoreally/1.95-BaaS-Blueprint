'use client';

import { useEffect, useState } from 'react';

type Obj = Record<string, unknown>;
const asObj = (value: unknown): Obj => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
const asArr = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export default function StorageManager({ slug }: { slug: string }) {
  const [fields, setFields] = useState<Array<{ collection: string; field: string }>>([]);
  const [collection, setCollection] = useState('');
  const [field, setField] = useState('');
  const [recordId, setRecordId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('Loading file fields…');
  const dataUrl = `/api/projects/${encodeURIComponent(slug)}/data?resource=collections`;

  useEffect(() => {
    fetch(dataUrl, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load collections');
        const next = asArr(asObj(data).items).flatMap((raw) => {
          const c = asObj(raw);
          const name = String(c.name || c.id || '');
          return asArr(c.fields)
            .map(asObj)
            .filter((item) => item.type === 'file')
            .map((item) => ({ collection: name, field: String(item.name || item.id || '') }));
        }).filter((item) => item.collection && item.field);
        setFields(next);
        if (next[0]) { setCollection(next[0].collection); setField(next[0].field); }
        setMessage(next.length ? '' : 'No file fields exist yet. Add a file field to a collection in Database first.');
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load storage schema'));
  }, [dataUrl]);

  async function upload() {
    if (!file || !collection || !field || !recordId) {
      setMessage('Choose a file field, enter a record ID, and select a file.');
      return;
    }
    setMessage('Uploading…');
    const form = new FormData();
    form.append('collection', collection);
    form.append('recordId', recordId);
    form.append('field', field);
    form.append('file', file);
    const response = await fetch(`/api/projects/${encodeURIComponent(slug)}/storage`, { method: 'POST', body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(String(data.error || 'Upload failed')); return; }
    setMessage(`Uploaded ${file.name} to ${collection}/${recordId}.${field}`);
    setFile(null);
  }

  return <>
    <section className="card" style={{ marginBottom: 14 }}>
      <h2 style={{ marginTop: 0 }}>File storage</h2>
      <p style={{ color: '#999' }}>Files are attached to PocketBase records. Uploads go through the authenticated control plane; the instance management key never enters the browser.</p>
      {fields.length ? <select value={`${collection}:${field}`} onChange={(event) => {
        const [nextCollection, nextField] = event.target.value.split(':');
        setCollection(nextCollection); setField(nextField);
      }}>
        {fields.map((item) => <option key={`${item.collection}:${item.field}`} value={`${item.collection}:${item.field}`}>{item.collection} · {item.field}</option>)}
      </select> : null}
      <div style={{ display: 'grid', gap: 10, maxWidth: 560, marginTop: 12 }}>
        <input value={recordId} onChange={(event) => setRecordId(event.target.value)} placeholder="Record ID" />
        <input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <button className="btn" onClick={() => void upload()} disabled={!fields.length}>Upload file</button>
      </div>
      {message ? <p style={{ color: message.includes('failed') || message.includes('Failed') ? '#ffb0b0' : '#999' }}>{message}</p> : null}
    </section>
    <section className="card"><h2 style={{ marginTop: 0 }}>Configured file fields</h2>{fields.map((item) => <div key={`${item.collection}:${item.field}`} style={{ padding: '8px 0', borderBottom: '1px solid #222' }}><strong>{item.collection}</strong> · {item.field}</div>)}</section>
  </>;
}
