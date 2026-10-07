// Unit tests for the JS SDK — mock fetch, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { InvisibleDB, InvisibleDBError } = await import('../dist/index.js');

function mockFetch(handler) {
  return async (url, init) => handler(url, init);
}

function json(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

test('constructor requires baseUrl and apiKey', () => {
  assert.throws(() => new InvisibleDB({ baseUrl: '', apiKey: 'k' }), /required/);
  assert.throws(() => new InvisibleDB({ baseUrl: 'https://x', apiKey: '' }), /required/);
});

test('getList builds query params and sends Bearer key', async () => {
  let seen;
  const db = new InvisibleDB({
    baseUrl: 'https://acme.invisibledb.app/',
    apiKey: 'idb_live_abc',
    fetchImpl: mockFetch((url, init) => {
      seen = { url, auth: init.headers.authorization, method: init.method };
      return json({ page: 1, perPage: 30, totalItems: 1, totalPages: 1, items: [{ id: '1' }] });
    }),
  });
  const res = await db.collection('messages').getList({ page: 2, perPage: 10, sort: '-created' });
  assert.equal(res.items.length, 1);
  assert.match(seen.url, /\/api\/collections\/messages\/records\?/);
  assert.match(seen.url, /page=2/);
  assert.equal(seen.auth, 'Bearer idb_live_abc');
  assert.equal(seen.method, 'GET');
});

test('401 maps to invalid api key error', async () => {
  const db = new InvisibleDB({
    baseUrl: 'https://acme.invisibledb.app',
    apiKey: 'bad',
    fetchImpl: mockFetch(() => json({ message: 'nope' }, 401)),
  });
  await assert.rejects(() => db.collection('x').getOne('1'), (e) => {
    assert.ok(e instanceof InvisibleDBError);
    assert.equal(e.status, 401);
    return true;
  });
});

test('create posts JSON body', async () => {
  let seen;
  const db = new InvisibleDB({
    baseUrl: 'https://acme.invisibledb.app',
    apiKey: 'k',
    fetchImpl: mockFetch((url, init) => {
      seen = { url, method: init.method, body: JSON.parse(init.body) };
      return json({ id: '2', text: 'hi' });
    }),
  });
  const rec = await db.collection('messages').create({ text: 'hi' });
  assert.equal(rec.id, '2');
  assert.equal(seen.method, 'POST');
  assert.deepEqual(seen.body, { text: 'hi' });
});

test('fileUrl builds the direct file path', () => {
  const db = new InvisibleDB({ baseUrl: 'https://acme.invisibledb.app', apiKey: 'k' });
  assert.equal(
    db.fileUrl('messages', 'rec1', 'a.png'),
    'https://acme.invisibledb.app/api/files/messages/rec1/a.png'
  );
});

test('vector.query posts embedding', async () => {
  let seen;
  const db = new InvisibleDB({
    baseUrl: 'https://acme.invisibledb.app',
    apiKey: 'k',
    fetchImpl: mockFetch((url, init) => {
      seen = { url, body: JSON.parse(init.body) };
      return json({ results: [] });
    }),
  });
  await db.vector.query('docs', [0.1, 0.2], 5);
  assert.match(seen.url, /\/api\/vector\/query$/);
  assert.deepEqual(seen.body, { collection: 'docs', embedding: [0.1, 0.2], limit: 5 });
});
