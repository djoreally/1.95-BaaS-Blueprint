/**
 * InvisibleDB auth gateway — zero dependencies, runs on plain node:20-alpine.
 *
 * Sits between Caddy and per-customer PocketBase containers:
 *   client -> Caddy (<slug>.BASE_DOMAIN, TLS) -> gateway:8080 -> idb-<slug>:8090
 *
 * Auth model (single-key, post pk_/sk_ revert):
 *   1. Client sends `Authorization: Bearer <apiKey>` (the key from /srv/idb/keys/<slug>.key).
 *   2. Gateway timing-safe-compares it. Mismatch -> 401, no proxying.
 *   3. Gateway swaps in a cached PocketBase superuser token for that customer's
 *      container (credentials from /srv/idb/keys/<slug>.admin) and proxies.
 *   4. On PocketBase 401 the gateway re-authenticates once and retries.
 *
 * The customer's key never reaches PocketBase; PocketBase never sees the internet.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = process.env.KEYS_DIR || '/keys';
const PORT = parseInt(process.env.PORT || '8080', 10);
// PB_UPSTREAM: override for tests. Default: idb-<slug> (docker network DNS).
const upstreamHost = (slug) => process.env.PB_UPSTREAM || `idb-${slug}`;

// ---- key + credential caches (re-read on mtime change) ----
const cache = new Map(); // slug -> { key, keyMtime, admin, adminMtime, pbToken }

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
  if (a.value !== null) { e.admin = a.value; e.adminMtime = a.mtime; } // "email:pass"
  if (!e.key || !e.admin) return null;
  return e;
}

// ---- PocketBase superuser auth (cached per slug) ----
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

// ---- proxy ----
function proxy(req, res, slug, entry, pbToken, retried) {
  const upstream = http.request({
    host: upstreamHost(slug), port: 8090,
    path: req.url, method: req.method,
    headers: { ...req.headers, host: `${upstreamHost(slug)}:8090`, authorization: `Bearer ${pbToken}` },
    timeout: 30000,
  }, (upRes) => {
    if (upRes.statusCode === 401 && !retried) {
      // Token expired mid-flight: drop cache, re-auth once, retry.
      entry.pbToken = null;
      pbTokenFor(slug, entry).then((t) => proxy(req, res, slug, entry, t, true))
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

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') { res.writeHead(200); res.end('ok'); return; }

  const host = (req.headers.host || '').split(':')[0];
  const slug = host.split('.')[0];
  const entry = entryFor(slug);
  if (!entry) { res.writeHead(404); res.end('unknown instance'); return; }

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expected = Buffer.from(entry.key);
  const got = Buffer.from(bearer);
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) {
    res.writeHead(401); res.end('invalid api key'); return;
  }

  try {
    const token = await pbTokenFor(slug, entry);
    proxy(req, res, slug, entry, token, false);
  } catch {
    res.writeHead(502); res.end('upstream unavailable');
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`idb-gateway listening on :${PORT}`));
