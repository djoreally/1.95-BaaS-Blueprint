/**
 * InvisibleDB auth gateway — zero dependencies, runs on plain node:20-alpine.
 *
 * Two credential lanes:
 *   - Instance server key (`idb_live_...`) => privileged management/server access.
 *     The gateway swaps it for the tenant PocketBase superuser token.
 *   - Normal PocketBase user token (or no token) => passed through unchanged.
 *     PocketBase collection rules remain the authorization boundary for web/mobile.
 *
 * This lets mobile/browser apps authenticate real end users without embedding the
 * instance server key while preserving the one-key server SDK experience.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = process.env.KEYS_DIR || '/keys';
const PORT = parseInt(process.env.PORT || '8080', 10);
const upstreamHost = (slug) => process.env.PB_UPSTREAM || `idb-${slug}`;

const cache = new Map();

function readIfChanged(file, prevMtime) {
  try {
    const st = fs.statSync(file);
    if (prevMtime && st.mtimeMs === prevMtime) return { value: null, mtime: prevMtime };
    return { value: fs.readFileSync(file, 'utf8').trim(), mtime: st.mtimeMs };
  } catch {
    return { value: null, mtime: 0, missing: true };
  }
}

function entryFor(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  let e = cache.get(slug);
  if (!e) { e = {}; cache.set(slug, e); }
  const k = readIfChanged(path.join(KEYS_DIR, `${slug}.key`), e.keyMtime);
  if (k.missing) { cache.delete(slug); return null; }
  if (k.value !== null) { e.key = k.value; e.keyMtime = k.mtime; }
  const a = readIfChanged(path.join(KEYS_DIR, `${slug}.admin`), e.adminMtime);
  if (a.value !== null) { e.admin = a.value; e.adminMtime = a.mtime; }
  if (!e.key || !e.admin) return null;
  return e;
}

function timingSafeMatch(value, expectedValue) {
  const got = Buffer.from(value || '');
  const expected = Buffer.from(expectedValue || '');
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

function pbRequest(slug, method, reqPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request({
      host: upstreamHost(slug), port: 8090, path: reqPath, method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 10000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('pb timeout')));
    if (data) req.write(data);
    req.end();
  });
}

async function pbTokenFor(slug, entry) {
  if (entry.pbToken) return entry.pbToken;
  const [email, pass] = entry.admin.split(':');
  const { status, body } = await pbRequest(slug, 'POST',
    '/api/collections/_superusers/auth-with-password', { identity: email, password: pass });
  if (status !== 200) throw new Error(`pb auth failed for ${slug}: ${status}`);
  entry.pbToken = JSON.parse(body.toString()).token;
  return entry.pbToken;
}

function proxyPublic(req, res, slug) {
  const upstream = http.request({
    host: upstreamHost(slug), port: 8090,
    path: req.url, method: req.method,
    headers: { ...req.headers, host: `${upstreamHost(slug)}:8090` },
    timeout: 30000,
  }, (upRes) => {
    res.writeHead(upRes.statusCode, upRes.headers);
    upRes.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502); res.end('bad gateway'); });
  upstream.on('timeout', () => upstream.destroy());
  req.pipe(upstream);
}

function proxyAdmin(req, res, slug, entry, pbToken, retried) {
  const upstream = http.request({
    host: upstreamHost(slug), port: 8090,
    path: req.url, method: req.method,
    headers: { ...req.headers, host: `${upstreamHost(slug)}:8090`, authorization: `Bearer ${pbToken}` },
    timeout: 30000,
  }, (upRes) => {
    if (upRes.statusCode === 401 && !retried) {
      entry.pbToken = null;
      pbTokenFor(slug, entry).then((t) => proxyAdmin(req, res, slug, entry, t, true))
        .catch(() => { res.writeHead(502); res.end('upstream auth failed'); });
      upRes.resume();
      return;
    }
    res.writeHead(upRes.statusCode, upRes.headers);
    upRes.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502); res.end('bad gateway'); });
  upstream.on('timeout', () => upstream.destroy());
  req.pipe(upstream);
}

function blockedPublicPath(reqUrl) {
  const pathname = String(reqUrl || '/').split('?')[0];
  return pathname.startsWith('/_/') ||
    pathname.startsWith('/api/collections/_superusers') ||
    pathname.startsWith('/api/settings') ||
    pathname.startsWith('/api/backups');
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') { res.writeHead(200); res.end('ok'); return; }

  const host = (req.headers.host || '').split(':')[0];
  const slug = host.split('.')[0];
  const entry = entryFor(slug);
  if (!entry) { res.writeHead(404); res.end('unknown instance'); return; }

  if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      service: 'InvisibleDB',
      instance: slug,
      status: 'ready',
      api: '/api',
      message: 'Connect with an InvisibleDB SDK or REST client.',
    }));
    return;
  }

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const serverKey = timingSafeMatch(bearer, entry.key);

  if (serverKey) {
    try {
      const token = await pbTokenFor(slug, entry);
      proxyAdmin(req, res, slug, entry, token, false);
    } catch {
      res.writeHead(502); res.end('upstream unavailable');
    }
    return;
  }

  // A mistyped server key should fail as a server key rather than being treated
  // as an end-user token. PocketBase JWT/user tokens do not use this prefix.
  if (bearer.startsWith('idb_live_')) {
    res.writeHead(401); res.end('invalid api key'); return;
  }

  if (blockedPublicPath(req.url)) {
    res.writeHead(403); res.end('management endpoint requires instance server key'); return;
  }

  // Normal browser/mobile lane: no token for public rules, or a PocketBase user
  // token for authenticated collection rules. The gateway does not elevate it.
  proxyPublic(req, res, slug);
});

server.listen(PORT, '0.0.0.0', () => console.log(`idb-gateway listening on :${PORT}`));
