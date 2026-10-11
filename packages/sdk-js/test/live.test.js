// Live conformance tests — run against a real PocketBase-backed InvisibleDB instance.
// Skipped unless INVISIBLEDB_LIVE_URL is set, so `npm test` stays offline.
//
//   INVISIBLEDB_LIVE_URL=http://127.0.0.1:8090 \
//   INVISIBLEDB_LIVE_EMAIL=alice@test.local \
//   INVISIBLEDB_LIVE_PASSWORD=... \
//   INVISIBLEDB_LIVE_COLLECTION=tasks \
//   npm run test:live
//
// The collection must allow public list/view, and authenticated create/update/delete.
// Fields used: title (text), status (text), priority (number), attachment (file, max 1),
// created/updated (autodate). Batch must be enabled for the transaction test to pass;
// otherwise that test asserts the 403 the server returns.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const { createClient, InvisibleDBError } = await import('../dist/index.js');

const URL_ = process.env.INVISIBLEDB_LIVE_URL;
const EMAIL = process.env.INVISIBLEDB_LIVE_EMAIL;
const PASSWORD = process.env.INVISIBLEDB_LIVE_PASSWORD;
const COLL = process.env.INVISIBLEDB_LIVE_COLLECTION || 'tasks';
const live = Boolean(URL_ && EMAIL && PASSWORD);
const skip = live ? false : 'set INVISIBLEDB_LIVE_URL, _EMAIL and _PASSWORD to run';

const tag = `sdk-${Date.now().toString(36)}`;

test('health is reachable without credentials', { skip }, async () => {
  const db = createClient({ url: URL_ });
  const h = await db.health();
  assert.equal(typeof h.message, 'string');
});

test('anonymous read of a public collection works (no Authorization header)', { skip }, async () => {
  const db = createClient({ url: URL_ });
  const list = await db.from(COLL).limit(1).execute();
  assert.equal(typeof list.totalItems, 'number');
  assert.ok(Array.isArray(list.items));
});

test('signIn returns user + token and sets currentUser; signOut clears it', { skip }, async () => {
  const db = createClient({ url: URL_ });
  const { token, user } = await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  assert.ok(token.length > 20);
  assert.equal(user.email, EMAIL);
  assert.equal(db.auth.currentUser()?.email, EMAIL);
  db.auth.signOut();
  assert.equal(db.auth.currentUser(), null);
  assert.equal(db.auth.getToken(), undefined);
});

test('signIn with wrong password fails with a 4xx InvisibleDBError', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await assert.rejects(() => db.auth.signIn({ email: EMAIL, password: 'definitely-wrong' }), (e) => {
    assert.ok(e instanceof InvisibleDBError);
    assert.ok(e.status >= 400 && e.status < 500, `status ${e.status}`);
    return true;
  });
});

test('write without auth is rejected by collection rules', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await assert.rejects(() => db.from(COLL).insert({ title: 'anon' }), (e) => {
    assert.ok(e instanceof InvisibleDBError);
    assert.ok(e.status >= 400 && e.status < 500);
    return true;
  });
});

test('insert -> get -> update -> remove round trip', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  const created = await db.from(COLL).insert({ title: `${tag}-crud`, status: 'open', priority: 1 });
  assert.ok(created.id);
  const got = await db.from(COLL).get(created.id);
  assert.equal(got.title, `${tag}-crud`);
  const updated = await db.from(COLL).update(created.id, { status: 'done' });
  assert.equal(updated.status, 'done');
  await db.from(COLL).remove(created.id);
  await assert.rejects(() => db.from(COLL).get(created.id), (e) => e.status === 404);
});

test('query builder: eq / neq / in / contains / order / limit / select / count', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  const a = await db.from(COLL).insert({ title: `${tag}-q-a`, status: 'open', priority: 5 });
  const b = await db.from(COLL).insert({ title: `${tag}-q-b`, status: 'closed', priority: 9 });
  try {
    const open = await db.from(COLL).select('id,title,status').contains('title', tag).eq('status', 'open').execute();
    assert.deepEqual(open.items.map((r) => r.id), [a.id]);
    assert.equal(open.items[0].title, `${tag}-q-a`);
    assert.equal(open.items[0].priority, undefined, 'projection must drop unselected fields');

    const notOpen = await db.from(COLL).contains('title', tag).neq('status', 'open').execute();
    assert.deepEqual(notOpen.items.map((r) => r.id), [b.id]);

    const both = await db.from(COLL).contains('title', tag).in('status', ['open', 'closed']).order('priority', { ascending: false }).execute();
    assert.deepEqual(both.items.map((r) => r.id), [b.id, a.id]);

    const first = await db.from(COLL).contains('title', tag).order('priority').limit(1).execute();
    assert.equal(first.items.length, 1);
    assert.equal(first.items[0].id, a.id);

    assert.equal(await db.from(COLL).contains('title', tag).count(), 2);
    assert.equal((await db.from(COLL).contains('title', tag).eq('status', 'open').single()).id, a.id);
    assert.equal(await db.from(COLL).eq('title', `${tag}-missing`).maybeSingle(), null);
    await assert.rejects(() => db.from(COLL).contains('title', tag).single(), (e) => e.status === 409);
  } finally {
    await db.from(COLL).remove(a.id).catch(() => {});
    await db.from(COLL).remove(b.id).catch(() => {});
  }
});

test('filter values are escaped; quotes and backslashes do not break the filter', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  const nasty = `${tag}-"quoted" \\ back`;
  const rec = await db.from(COLL).insert({ title: nasty, status: 'open' });
  try {
    const hit = await db.from(COLL).eq('title', nasty).execute();
    assert.equal(hit.totalItems, 1);
    assert.equal(hit.items[0].id, rec.id);
  } finally {
    await db.from(COLL).remove(rec.id).catch(() => {});
  }
});

test('invalid field names are rejected before any request is made', () => {
  const calls = [];
  const db = createClient({ url: 'http://127.0.0.1:1', fetchImpl: async (u) => { calls.push(u); throw new Error('no'); } });
  assert.throws(() => db.from('tasks').eq('title; drop', 'x'), TypeError);
  assert.throws(() => db.from('tasks').order('a b'), TypeError);
  assert.throws(() => db.from('ta/sks'), TypeError);
  assert.equal(calls.length, 0);
});

test('file upload, public URL, signed URL, and removal', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  const rec = await db.from(COLL).insert({ title: `${tag}-file`, status: 'open' });
  try {
    const bytes = new TextEncoder().encode(`hello ${tag}`);
    const updated = await db.storage.upload({
      collection: COLL, recordId: rec.id, field: 'attachment', file: bytes, filename: 'hello.txt',
    });
    const stored = updated.attachment;
    assert.ok(typeof stored === 'string' && stored.endsWith('.txt'), `attachment=${stored}`);

    const publicUrl = db.storage.url(COLL, rec.id, stored);
    const res = await fetch(publicUrl);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), `hello ${tag}`);

    const signed = await db.storage.signedUrl(COLL, rec.id, stored);
    assert.match(signed, /token=/);
    assert.equal((await fetch(signed)).status, 200);

    const cleared = await db.storage.remove({ collection: COLL, recordId: rec.id, field: 'attachment', filename: stored });
    assert.equal(cleared.attachment, '');
  } finally {
    await db.from(COLL).remove(rec.id).catch(() => {});
  }
});

test('signUp creates an account and signs it in', { skip }, async () => {
  const db = createClient({ url: URL_ });
  const email = `${tag}@test.local`;
  const { user, token } = await db.auth.signUp({ email, password: 'SdkTest12345!', name: 'SDK Test' });
  assert.equal(user.email, email);
  assert.ok(token);
  assert.equal(db.auth.currentUser()?.email, email);
});

test('password reset request resolves for unknown emails (no enumeration)', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await db.auth.resetPassword(`nobody-${tag}@test.local`);
});

test('transaction: atomic batch when enabled; a clear 403 when disabled', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  let results;
  try {
    results = await db.transaction([
      { type: 'create', collection: COLL, data: { title: `${tag}-tx-1`, status: 'open' } },
      { type: 'create', collection: COLL, data: { title: `${tag}-tx-2`, status: 'open' } },
    ]);
  } catch (e) {
    assert.ok(e instanceof InvisibleDBError, String(e));
    assert.equal(e.status, 403, `unexpected failure: ${e.message}`);
    return; // batch disabled on this instance: the SDK surfaces the server's 403
  }
  assert.equal(results.length, 2);
  for (const r of results) await db.from(COLL).remove(r.body.id).catch(() => {});
});

test('realtime: create event is delivered to a subscriber', { skip: skip || typeof globalThis.EventSource !== 'function' ? (skip || 'no global EventSource (run with --experimental-eventsource on Node 22)') : false }, async () => {
  const db = createClient({ url: URL_, eventSourceImpl: globalThis.EventSource });
  await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  const action = await new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no realtime event within 8s')), 8000);
    const unsubscribe = db.realtime.subscribe(COLL, (event) => {
      if (event.record?.title !== `${tag}-rt`) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(event.action);
    });
    await new Promise((r) => setTimeout(r, 1200));
    const rec = await db.from(COLL).insert({ title: `${tag}-rt`, status: 'open' });
    await db.from(COLL).remove(rec.id).catch(() => {});
  });
  assert.equal(action, 'create');
});

test('rpc.call reaches the runtime; unknown procedure maps to not_found', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  const who = await db.rpc('whoami');
  assert.equal(who.email, EMAIL);
  await assert.rejects(db.rpc('definitely_missing_proc'), (err) => err.code === 'not_found');
});

test('rpc requires a session: anonymous call maps to unauthenticated', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await assert.rejects(db.rpc('whoami'), (err) => err instanceof InvisibleDBError && err.code === 'unauthenticated');
});

test('functions.invoke echoes its payload for a signed-in user', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  const out = await db.functions.invoke('echo', { tag, nested: { n: [1, 2] } });
  assert.deepEqual(out, { echo: { tag, nested: { n: [1, 2] } } });
});

test('rpc.call complete_task closes a task the caller owns and rejects a missing id', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  const rec = await db.from(COLL).insert({ title: `${tag}-rpc`, status: 'open' });
  try {
    const done = await db.rpc('complete_task', { id: rec.id });
    assert.equal(done.status, 'done');
    await assert.rejects(db.rpc('complete_task', {}), (err) => err.code === 'bad_request');
  } finally {
    await db.from(COLL).remove(rec.id).catch(() => {});
  }
});

test('request timeout is enforced against the live server', { skip }, async () => {
  const db = createClient({ url: URL_, timeoutMs: 1, retry: false });
  await assert.rejects(db.health(), (err) => err.code === 'timeout' || err.code === 'network_error');
});

test('relationships: a relation field stores the id and expand resolves it', { skip }, async () => {
  const db = createClient({ url: URL_ });
  const session = await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  const owner = session.user.id;
  const rec = await db.from(COLL).insert({ title: `${tag}-rel`, status: 'open', owner });
  try {
    assert.equal(rec.owner, owner);
    const got = await db.from(COLL).expand('owner').get(rec.id);
    assert.equal(got.expand?.owner?.id, owner);
  } finally {
    await db.from(COLL).remove(rec.id).catch(() => {});
  }
});

test('error codes: invalid input to a procedure maps to bad_request; unknown record to not_found', { skip }, async () => {
  const db = createClient({ url: URL_ });
  await db.auth.signIn({ email: EMAIL, password: PASSWORD });
  await assert.rejects(db.rpc('complete_task', { id: 'not a valid id!' }), (err) => err.code === 'bad_request');
  await assert.rejects(db.collection(COLL).getOne('zzzzzzzzzzzzzzz'), (err) => err.code === 'not_found' && err.status === 404);
});

test('permissions: an anonymous insert is rejected and leaves no record behind', { skip }, async () => {
  const db = createClient({ url: URL_ });
  const before = await db.from(COLL).count();
  await assert.rejects(db.from(COLL).insert({ title: `${tag}-anon`, status: 'open' }), (err) => err instanceof InvisibleDBError && err.status >= 400);
  const after = await db.from(COLL).count();
  assert.equal(after, before);
});
