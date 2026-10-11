// Offline tests for the transport: error codes, timeouts, retries, rpc and functions.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { createClient, InvisibleDBError, codeForStatus } = await import('../dist/index.js');

const NO_WAIT = { attempts: 3, baseDelayMs: 0, maxDelayMs: 0 };

/** Scripted fetch: each call consumes the next scripted step (a response object or an Error). */
function scripted(steps) {
  const calls = [];
  let i = 0;
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: new URL(url), method: init.method, headers: init.headers || {}, signal: init.signal });
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    if (step instanceof Error) throw step;
    const status = step.status ?? 200;
    const text = step.raw ?? (step.body === undefined ? '' : JSON.stringify(step.body));
    const headers = new Map(Object.entries(step.headers ?? {}));
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      headers: { get: (k) => headers.get(k.toLowerCase()) ?? null },
      json: async () => JSON.parse(text),
      text: async () => text,
    };
  };
  return { calls, fetchImpl };
}

test('codeForStatus maps HTTP statuses to stable codes', () => {
  assert.equal(codeForStatus(400), 'bad_request');
  assert.equal(codeForStatus(401), 'unauthenticated');
  assert.equal(codeForStatus(403), 'forbidden');
  assert.equal(codeForStatus(404), 'not_found');
  assert.equal(codeForStatus(409), 'conflict');
  assert.equal(codeForStatus(413), 'payload_too_large');
  assert.equal(codeForStatus(429), 'rate_limited');
  assert.equal(codeForStatus(503), 'server_error');
  assert.equal(codeForStatus(418), 'http_error');
});

test('errors carry code, status, data and the server request id', async () => {
  const { fetchImpl } = scripted([
    { status: 403, body: { message: 'Not allowed.', data: {} }, headers: { 'x-request-id': 'req-123' } },
  ]);
  const db = createClient({ url: 'https://x', fetchImpl, retry: false });
  await assert.rejects(db.collection('tasks').create({ title: 'x' }), (err) => {
    assert.ok(err instanceof InvisibleDBError);
    assert.equal(err.code, 'forbidden');
    assert.equal(err.status, 403);
    assert.equal(err.requestId, 'req-123');
    return true;
  });
});

test('network failure throws InvisibleDBError with code network_error and status 0', async () => {
  const { fetchImpl } = scripted([new TypeError('fetch failed')]);
  const db = createClient({ url: 'https://x', fetchImpl, retry: false });
  await assert.rejects(db.collection('tasks').getList(), (err) => {
    assert.ok(err instanceof InvisibleDBError);
    assert.equal(err.code, 'network_error');
    assert.equal(err.status, 0);
    assert.ok(err.cause instanceof TypeError);
    return true;
  });
});

test('timeout aborts the request and throws code timeout', async () => {
  let seenSignal;
  const fetchImpl = (url, init) => {
    seenSignal = init.signal;
    return new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  };
  const db = createClient({ url: 'https://x', fetchImpl, timeoutMs: 20, retry: false });
  await assert.rejects(db.collection('tasks').getList(), (err) => {
    assert.equal(err.code, 'timeout');
    assert.equal(seenSignal.aborted, true);
    return true;
  });
});

test('GET retries 503 and then succeeds', async () => {
  const { calls, fetchImpl } = scripted([
    { status: 503, body: { message: 'busy' } },
    { status: 200, body: { items: [], page: 1, perPage: 30, totalItems: 0, totalPages: 0 } },
  ]);
  const db = createClient({ url: 'https://x', fetchImpl, retry: NO_WAIT });
  const list = await db.collection('tasks').getList();
  assert.equal(list.totalItems, 0);
  assert.equal(calls.length, 2);
});

test('GET retries network errors and gives up after the configured attempts', async () => {
  const { calls, fetchImpl } = scripted([new TypeError('reset')]);
  const db = createClient({ url: 'https://x', fetchImpl, retry: { attempts: 2, baseDelayMs: 0, maxDelayMs: 0 } });
  await assert.rejects(db.collection('tasks').getList(), (err) => err.code === 'network_error');
  assert.equal(calls.length, 2);
});

test('POST is never retried, even on 503 or network errors', async () => {
  const { calls, fetchImpl } = scripted([{ status: 503, body: { message: 'busy' } }]);
  const db = createClient({ url: 'https://x', fetchImpl, retry: NO_WAIT });
  await assert.rejects(db.collection('tasks').create({ title: 'x' }), (err) => err.code === 'server_error');
  assert.equal(calls.length, 1);
});

test('rpc.call is never retried automatically', async () => {
  const { calls, fetchImpl } = scripted([{ status: 502, body: { message: 'bad gateway' } }]);
  const db = createClient({ url: 'https://x', fetchImpl, retry: NO_WAIT });
  await assert.rejects(db.rpc('complete_task', { id: 'abc' }));
  assert.equal(calls.length, 1);
});

test('retry: false disables GET retries', async () => {
  const { calls, fetchImpl } = scripted([{ status: 503, body: { message: 'busy' } }]);
  const db = createClient({ url: 'https://x', fetchImpl, retry: false });
  await assert.rejects(db.collection('tasks').getList(), (err) => err.code === 'server_error');
  assert.equal(calls.length, 1);
});

test('Retry-After header is honoured (capped at maxDelayMs)', async () => {
  const { calls, fetchImpl } = scripted([
    { status: 429, body: { message: 'slow down' }, headers: { 'retry-after': '0' } },
    { status: 200, body: { items: [], page: 1, perPage: 30, totalItems: 0, totalPages: 0 } },
  ]);
  const db = createClient({ url: 'https://x', fetchImpl, retry: { attempts: 2, baseDelayMs: 1000, maxDelayMs: 5 } });
  await db.collection('tasks').getList();
  assert.equal(calls.length, 2);
});

test('invalid JSON on a 200 response surfaces as an InvisibleDBError', async () => {
  const { fetchImpl } = scripted([{ status: 200, raw: '<html>proxy</html>' }]);
  const db = createClient({ url: 'https://x', fetchImpl, retry: false });
  await assert.rejects(db.collection('tasks').getList(), (err) => {
    assert.ok(err instanceof InvisibleDBError);
    assert.equal(err.status, 200);
    assert.equal(err.code, 'http_error');
    return true;
  });
});

test('rpc posts to the rpc route with the params as JSON', async () => {
  const { calls, fetchImpl } = scripted([{ status: 200, body: { id: 'abc', status: 'done' } }]);
  const db = createClient({ url: 'https://acme.invisibledb.app', fetchImpl, apiKey: 'idb_live_k' });
  const out = await db.rpc('complete_task', { id: 'abc' });
  assert.deepEqual(out, { id: 'abc', status: 'done' });
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url.pathname, '/api/invisibledb/rpc/complete_task');
  assert.equal(calls[0].headers['content-type'], 'application/json');
  assert.equal(calls[0].headers.authorization, 'Bearer idb_live_k');
});

test('rpc with no params sends an empty object', async () => {
  const { calls, fetchImpl } = scripted([{ status: 200, body: { ok: true } }]);
  const db = createClient({ url: 'https://x', fetchImpl });
  await db.rpc('ping');
  assert.equal(calls[0].url.pathname, '/api/invisibledb/rpc/ping');
});

test('functions.invoke posts to the functions route', async () => {
  const { calls, fetchImpl } = scripted([{ status: 200, body: { echo: { a: 1 } } }]);
  const db = createClient({ url: 'https://x', fetchImpl });
  const out = await db.functions.invoke('echo', { a: 1 });
  assert.deepEqual(out, { echo: { a: 1 } });
  assert.equal(calls[0].url.pathname, '/api/invisibledb/functions/echo');
});

test('rpc and function names are validated before any request is sent', async () => {
  const { calls, fetchImpl } = scripted([{ status: 200, body: {} }]);
  const db = createClient({ url: 'https://x', fetchImpl });
  for (const bad of ['', 'Upper', '1starts_digit', '../escape', 'has-dash', 'x'.repeat(65)]) {
    assert.throws(() => db.rpc(bad), TypeError, `rpc ${JSON.stringify(bad)}`);
    assert.throws(() => db.functions.invoke(bad), TypeError, `function ${JSON.stringify(bad)}`);
  }
  assert.equal(calls.length, 0);
});

test('timeoutMs must be positive', () => {
  assert.throws(() => createClient({ url: 'https://x', timeoutMs: 0 }), TypeError);
});

test('user-facing timeout error reports the configured timeout', async () => {
  const fetchImpl = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('x'))));
  const db = createClient({ url: 'https://x', fetchImpl, timeoutMs: 15, retry: false });
  await assert.rejects(db.collection('tasks').getList(), (err) => /15ms/.test(err.message));
});

test('get/insert/update forward select() and expand() as query parameters', async () => {
  const rec = { id: 'abc', title: 't', expand: { owner: { id: 'u1' } } };
  const { calls, fetchImpl } = scripted([{ status: 200, body: rec }]);
  const db = createClient({ url: 'https://x', fetchImpl, retry: false });
  await db.from('tasks').select('id,title').expand('owner').get('abc');
  assert.equal(calls[0].url.searchParams.get('fields'), 'id,title');
  assert.equal(calls[0].url.searchParams.get('expand'), 'owner');
  await db.from('tasks').expand('owner').insert({ title: 't' });
  assert.equal(calls[1].url.searchParams.get('expand'), 'owner');
  assert.equal(calls[1].url.searchParams.has('filter'), false);
  await db.from('tasks').get('abc');
  assert.equal(calls[2].url.search, '');
});
