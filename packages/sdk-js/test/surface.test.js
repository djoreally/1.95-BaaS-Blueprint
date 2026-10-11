// Offline tests for the universal surface: query compiler, literal encoding, auth flows,
// storage, transactions, error mapping. No network — fetch is mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { createClient, InvisibleDBError, QueryBuilder } = await import('../dist/index.js');

function recorder(responder = () => ({ status: 200, body: { items: [], page: 1, perPage: 30, totalItems: 0, totalPages: 0 } })) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const r = responder(url, init);
    calls.push({ url: new URL(url), method: init.method, headers: init.headers || {}, body: init.body });
    const status = r.status ?? 200;
    const text = r.raw ?? (r.body === undefined ? '' : JSON.stringify(r.body));
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      json: async () => JSON.parse(text),
      text: async () => text,
    };
  };
  return { calls, fetchImpl };
}

test('query compiler: select, filters, order, limit, expand', async () => {
  const { calls, fetchImpl } = recorder();
  const db = createClient({ url: 'https://acme.invisibledb.app', fetchImpl });
  await db.from('tasks').select('id,title').eq('status', 'open').gt('priority', 2).order('created', { ascending: false }).limit(10).expand('owner').execute();
  const q = calls[0].url.searchParams;
  assert.equal(calls[0].url.pathname, '/api/collections/tasks/records');
  assert.equal(q.get('fields'), 'id,title');
  assert.equal(q.get('filter'), 'status = "open" && priority > 2');
  assert.equal(q.get('sort'), '-created');
  assert.equal(q.get('perPage'), '10');
  assert.equal(q.get('expand'), 'owner');
});

test('query compiler: in(), filter() raw, contains(), neq(), null equality', async () => {
  const { calls, fetchImpl } = recorder();
  const db = createClient({ url: 'https://x', fetchImpl });
  await db.from('tasks').in('status', ['open', 'closed']).contains('title', 'ship').neq('owner', null).filter('priority >= 1').execute();
  assert.equal(
    calls[0].url.searchParams.get('filter'),
    '(status = "open" || status = "closed") && title ~ "ship" && owner != null && (priority >= 1)',
  );
});

test('string literals: only double quotes are escaped; backslashes are literal', async () => {
  const { calls, fetchImpl } = recorder();
  const db = createClient({ url: 'https://x', fetchImpl });
  await db.from('tasks').eq('title', 'say "hi" \\ there').execute();
  assert.equal(calls[0].url.searchParams.get('filter'), 'title = "say \\"hi\\" \\ there"');
});

test('string literal ending in a backslash is rejected locally, not sent', () => {
  const { calls, fetchImpl } = recorder();
  const db = createClient({ url: 'https://x', fetchImpl });
  assert.throws(() => db.from('tasks').eq('title', 'C:\\temp\\'), TypeError);
  assert.equal(calls.length, 0);
});

test('invalid identifiers are rejected: fields, collections, ids are not interpolated raw', () => {
  const { fetchImpl } = recorder();
  const db = createClient({ url: 'https://x', fetchImpl });
  assert.throws(() => db.from('tasks').eq('title = "x" || 1=1 --', 'a'), TypeError);
  assert.throws(() => db.from('tasks').select('id,bad field'), TypeError);
  assert.throws(() => db.from('tasks').in('status', []), TypeError);
  assert.throws(() => db.from('tasks').limit(0), TypeError);
  assert.throws(() => db.from('tasks').eq('priority', Number.NaN), TypeError);
});

test('record ids are percent-encoded in paths', async () => {
  const { calls, fetchImpl } = recorder(() => ({ body: { id: 'a/b' } }));
  const db = createClient({ url: 'https://x', fetchImpl });
  await db.from('tasks').get('a/b?x');
  assert.equal(calls[0].url.pathname, '/api/collections/tasks/records/a%2Fb%3Fx');
});

test('single(): 0 rows -> 404, many rows -> 409, one row -> the record', async () => {
  const none = recorder(() => ({ body: { items: [], page: 1, perPage: 2, totalItems: 0, totalPages: 0 } }));
  await assert.rejects(() => createClient({ url: 'https://x', fetchImpl: none.fetchImpl }).from('t').single(), (e) => e.status === 404);
  const many = recorder(() => ({ body: { items: [{ id: '1' }, { id: '2' }], page: 1, perPage: 2, totalItems: 2, totalPages: 1 } }));
  await assert.rejects(() => createClient({ url: 'https://x', fetchImpl: many.fetchImpl }).from('t').single(), (e) => e.status === 409);
  const one = recorder(() => ({ body: { items: [{ id: '1' }], page: 1, perPage: 2, totalItems: 1, totalPages: 1 } }));
  assert.equal((await createClient({ url: 'https://x', fetchImpl: one.fetchImpl }).from('t').single()).id, '1');
});

test('count() reads totalItems with perPage=1', async () => {
  const { calls, fetchImpl } = recorder(() => ({ body: { items: [], page: 1, perPage: 1, totalItems: 42, totalPages: 42 } }));
  const db = createClient({ url: 'https://x', fetchImpl });
  assert.equal(await db.from('tasks').eq('status', 'open').count(), 42);
  assert.equal(calls[0].url.searchParams.get('perPage'), '1');
});

test('builder is awaitable and returns the canonical list shape', async () => {
  const { fetchImpl } = recorder(() => ({ body: { items: [{ id: 'r1' }], page: 1, perPage: 30, totalItems: 1, totalPages: 1 } }));
  const res = await createClient({ url: 'https://x', fetchImpl }).from('tasks');
  assert.ok(res instanceof Object);
  assert.equal(res.items[0].id, 'r1');
  assert.equal(res.totalItems, 1);
  assert.ok(new QueryBuilder(createClient({ url: 'https://x', fetchImpl }), 'tasks') instanceof QueryBuilder);
});

test('insert / update / remove issue the right verbs and bodies', async () => {
  const { calls, fetchImpl } = recorder(() => ({ body: { id: 'r1', title: 't' } }));
  const db = createClient({ url: 'https://x', apiKey: 'idb_live_k', fetchImpl });
  await db.from('tasks').insert({ title: 't' });
  await db.from('tasks').update('r1', { title: 'u' });
  await db.from('tasks').remove('r1');
  assert.deepEqual(calls.map((c) => c.method), ['POST', 'PATCH', 'DELETE']);
  assert.deepEqual(JSON.parse(calls[0].body), { title: 't' });
  assert.equal(calls[1].url.pathname, '/api/collections/tasks/records/r1');
  assert.equal(calls[0].headers.authorization, 'Bearer idb_live_k');
});

test('signIn returns { user, token } and stores currentUser; signOut clears', async () => {
  const { calls, fetchImpl } = recorder((url) =>
    url.endsWith('/auth-with-password')
      ? { body: { token: 'tok1', record: { id: 'u1', email: 'a@b.co' } } }
      : { body: {} });
  const db = createClient({ url: 'https://x', apiKey: 'idb_live_secret', fetchImpl });
  const { user, token, record } = await db.auth.signIn({ email: 'a@b.co', password: 'pw' });
  assert.equal(token, 'tok1');
  assert.equal(user.email, 'a@b.co');
  assert.equal(record.id, 'u1');
  assert.equal(db.auth.currentUser().id, 'u1');
  assert.equal(calls[0].url.pathname, '/api/collections/users/auth-with-password');
  assert.equal(calls[0].headers.authorization, undefined, 'sign-in must never send the server key');
  db.auth.signOut();
  assert.equal(db.auth.currentUser(), null);
  assert.equal(db.auth.getToken(), undefined);
});

test('signUp posts to the auth collection with passwordConfirm, then signs in', async () => {
  const { calls, fetchImpl } = recorder((url) =>
    url.endsWith('/records')
      ? { body: { id: 'u2', email: 'n@b.co' } }
      : { body: { token: 'tok2', record: { id: 'u2', email: 'n@b.co' } } });
  const db = createClient({ url: 'https://x', fetchImpl, authCollection: 'members' });
  const res = await db.auth.signUp({ email: 'n@b.co', password: 'pw123456', name: 'N' });
  assert.equal(res.token, 'tok2');
  assert.equal(calls[0].url.pathname, '/api/collections/members/records');
  assert.deepEqual(JSON.parse(calls[0].body), { email: 'n@b.co', password: 'pw123456', name: 'N', passwordConfirm: 'pw123456' });
  assert.equal(calls[1].url.pathname, '/api/collections/members/auth-with-password');
});

test('password reset and verification hit the auth collection without credentials', async () => {
  const { calls, fetchImpl } = recorder(() => ({ status: 204 }));
  const db = createClient({ url: 'https://x', apiKey: 'idb_live_secret', fetchImpl });
  await db.auth.resetPassword('a@b.co');
  await db.auth.confirmResetPassword({ token: 't', password: 'newpw123' });
  await db.auth.verifyEmail('a@b.co');
  await db.auth.confirmVerifyEmail('vt');
  assert.deepEqual(calls.map((c) => new URL(c.url).pathname), [
    '/api/collections/users/request-password-reset',
    '/api/collections/users/confirm-password-reset',
    '/api/collections/users/request-verification',
    '/api/collections/users/confirm-verification',
  ]);
  for (const c of calls) assert.equal(c.headers.authorization, undefined);
});

test('storage.upload sends multipart PATCH with the file under the field name', async () => {
  const { calls, fetchImpl } = recorder(() => ({ body: { id: 'r1', attachment: 'x_1.txt' } }));
  const db = createClient({ url: 'https://x', authToken: 'user-tok', fetchImpl });
  const out = await db.storage.upload({ collection: 'tasks', recordId: 'r1', field: 'attachment', file: new Uint8Array([104, 105]), filename: 'hi.txt' });
  assert.equal(out.attachment, 'x_1.txt');
  assert.equal(calls[0].method, 'PATCH');
  assert.equal(calls[0].url.pathname, '/api/collections/tasks/records/r1');
  assert.ok(calls[0].body instanceof FormData);
  const file = calls[0].body.get('attachment');
  assert.equal(file.name, 'hi.txt');
  assert.equal(calls[0].headers['content-type'], undefined, 'multipart content-type must be set by fetch, not the SDK');
  assert.equal(calls[0].headers.authorization, 'Bearer user-tok');
});

test('storage.upload requires a filename for unnamed bytes', () => {
  const { fetchImpl } = recorder();
  const db = createClient({ url: 'https://x', fetchImpl });
  assert.throws(() => db.storage.upload({ collection: 'tasks', recordId: 'r1', field: 'attachment', file: new Uint8Array([1]) }), TypeError);
});

test('storage.url appends thumb; storage.remove sends the field- modifier with the filename', async () => {
  const { calls, fetchImpl } = recorder(() => ({ body: { id: 'r1', attachment: '' } }));
  const db = createClient({ url: 'https://acme.invisibledb.app', fetchImpl });
  assert.equal(db.storage.url('tasks', 'r1', 'a b.png', { thumb: '100x100' }), 'https://acme.invisibledb.app/api/files/tasks/r1/a%20b.png?thumb=100x100');
  await db.storage.remove({ collection: 'tasks', recordId: 'r1', field: 'attachment', filename: 'a.png' });
  assert.deepEqual(JSON.parse(calls[0].body), { 'attachment-': ['a.png'] });
});

test('storage.signedUrl fetches a file token and appends it', async () => {
  const { calls, fetchImpl } = recorder((url) => (url.endsWith('/api/files/token') ? { body: { token: 'ft+1' } } : { body: {} }));
  const db = createClient({ url: 'https://x', authToken: 'user-tok', fetchImpl });
  const signed = await db.storage.signedUrl('tasks', 'r1', 'a.png');
  assert.equal(calls[0].url.pathname, '/api/files/token');
  assert.equal(signed, 'https://x/api/files/tasks/r1/a.png?token=ft%2B1');
});

test('transaction builds one batch request with the right verbs', async () => {
  const { calls, fetchImpl } = recorder(() => ({ body: [{ status: 200, body: { id: 'a' } }] }));
  const db = createClient({ url: 'https://x', authToken: 'user-tok', fetchImpl });
  await db.transaction([
    { type: 'create', collection: 'tasks', data: { title: 'a' } },
    { type: 'update', collection: 'tasks', id: 'r1', data: { status: 'done' } },
    { type: 'delete', collection: 'tasks', id: 'r2' },
  ]);
  assert.equal(calls[0].url.pathname, '/api/batch');
  assert.deepEqual(JSON.parse(calls[0].body).requests, [
    { method: 'POST', url: '/api/collections/tasks/records', body: { title: 'a' } },
    { method: 'PATCH', url: '/api/collections/tasks/records/r1', body: { status: 'done' } },
    { method: 'DELETE', url: '/api/collections/tasks/records/r2' },
  ]);
});

test('server error bodies are parsed: message and data are exposed on InvisibleDBError', async () => {
  const { fetchImpl } = recorder(() => ({
    status: 400,
    body: { data: { title: { code: 'validation_required', message: 'Cannot be blank.' } }, message: 'Failed to create record.', status: 400 },
  }));
  const db = createClient({ url: 'https://x', fetchImpl });
  await assert.rejects(() => db.from('tasks').insert({}), (e) => {
    assert.ok(e instanceof InvisibleDBError);
    assert.equal(e.status, 400);
    assert.equal(e.message, 'InvisibleDB 400: Failed to create record.');
    assert.equal(e.data.title.code, 'validation_required');
    return true;
  });
});

test('url alias works and baseUrl is required', () => {
  assert.throws(() => createClient({}), /baseUrl/);
  const { calls, fetchImpl } = recorder(() => ({ body: { message: 'ok', data: {} } }));
  return createClient({ url: 'https://acme.invisibledb.app/', fetchImpl }).health().then(() => {
    assert.equal(calls[0].url.toString(), 'https://acme.invisibledb.app/api/health');
  });
});
