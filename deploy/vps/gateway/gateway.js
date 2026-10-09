/**
 * InvisibleDB auth gateway — zero dependencies, runs on plain node:20-alpine.
 *
 * Security boundaries:
 *   - Only Caddy may forward customer traffic (X-IDB-Edge-Secret).
 *   - Instance server key (`idb_live_...`) => privileged management/server access.
 *   - Normal PocketBase user token (or no token) => passed through unchanged and
 *     remains subject to PocketBase collection rules.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Transform } = require('stream');

const KEYS_DIR = process.env.KEYS_DIR || '/keys';
const PORT = parseInt(process.env.PORT || '8080', 10);
const EDGE_SECRET = process.env.EDGE_SECRET || '';
const MAX_BODY_BYTES = Math.max(1024, parseInt(process.env.MAX_BODY_BYTES || String(64 * 1024 * 1024), 10));
const PUBLIC_RATE_PER_MINUTE = Math.max(10, parseInt(process.env.PUBLIC_RATE_PER_MINUTE || '600', 10));
const MANAGEMENT_RATE_PER_MINUTE = Math.max(10, parseInt(process.env.MANAGEMENT_RATE_PER_MINUTE || '180', 10));
const upstreamHost = (slug) => process.env.PB_UPSTREAM || `idb-${slug}`;
const cache = new Map();
const rateBuckets = new Map();

if (!EDGE_SECRET || EDGE_SECRET.length < 32) {
  throw new Error('EDGE_SECRET must be set to at least 32 characters');
}

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

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function rateAllowed(key, limit) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;
  const current = rateBuckets.get(key);
  if (!current || current.windowStart !== windowStart) {
    rateBuckets.set(key, { windowStart, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

setInterval(() => {
  const cutoff = Date.now() - 120000;
  for (const [key, value] of rateBuckets) {
    if (value.windowStart < cutoff) rateBuckets.delete(key);
  }
}, 60000).unref();

function cleanProxyHeaders(headers, host) {
  const out = { ...headers, host };
  delete out.connection;
  delete out['proxy-connection'];
  delete out['keep-alive'];
  delete out['transfer-encoding'];
  delete out.upgrade;
  delete out['x-idb-edge-secret'];
  return out;
}

function rejectOversizedDeclaredBody(req, res) {
  const raw = req.headers['content-length'];
  if (!raw) return false;
  const size = Number(raw);
  if (!Number.isFinite(size) || size < 0) {
    res.writeHead(400); res.end('invalid content length'); return true;
  }
  if (size > MAX_BODY_BYTES) {
    res.writeHead(413); res.end('request body too large'); return true;
  }
  return false;
}

function pipeWithLimit(req, upstream, res) {
  let total = 0;
  let exceeded = false;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        exceeded = true;
        callback(new Error('request body too large'));
        return;
      }
      callback(null, chunk);
    },
  });

  limiter.on('error', () => {
    upstream.destroy();
    if (!res.headersSent) { res.writeHead(413); res.end('request body too large'); }
    else res.destroy();
  });
  req.on('aborted', () => upstream.destroy());
  req.on('error', () => upstream.destroy());
  upstream.on('close', () => { if (exceeded && !res.writableEnded) res.destroy(); });
  req.pipe(limiter).pipe(upstream);
}

function pbRequest(slug, method, reqPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const request = http.request({
      host: upstreamHost(slug), port: 8090, path: reqPath, method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 10000,
    }, (response) => {
      const chunks = [];
      response.on('data', (c) => chunks.push(c));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('pb timeout')));
    if (data) request.write(data);
    request.end();
  });
}

async function pbTokenFor(slug, entry) {
  if (entry.pbToken) return entry.pbToken;
  const split = entry.admin.indexOf(':');
  if (split <= 0) throw new Error(`invalid admin credential for ${slug}`);
  const email = entry.admin.slice(0, split);
  const pass = entry.admin.slice(split + 1);
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
    headers: cleanProxyHeaders(req.headers, `${upstreamHost(slug)}:8090`),
    timeout: 30000,
  }, (upRes) => {
    res.writeHead(upRes.statusCode, upRes.headers);
    upRes.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('bad gateway'); });
  upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
  pipeWithLimit(req, upstream, res);
}

function proxyAdmin(req, res, slug, entry, pbToken) {
  const headers = cleanProxyHeaders(req.headers, `${upstreamHost(slug)}:8090`);
  headers.authorization = `Bearer ${pbToken}`;
  const upstream = http.request({
    host: upstreamHost(slug), port: 8090,
    path: req.url, method: req.method,
    headers,
    timeout: 30000,
  }, (upRes) => {
    if (upRes.statusCode === 401) entry.pbToken = null;
    res.writeHead(upRes.statusCode, upRes.headers);
    upRes.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('bad gateway'); });
  upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
  pipeWithLimit(req, upstream, res);
}

function blockedPublicPath(reqUrl) {
  const pathname = String(reqUrl || '/').split('?')[0];
  return pathname.startsWith('/_/') ||
    pathname.startsWith('/api/collections/_superusers') ||
    pathname.startsWith('/api/settings') ||
    pathname.startsWith('/api/backups') ||
    pathname === '/api/vector/upsert' ||
    pathname === '/api/vector/delete' ||
    pathname === '/api/vector/status';
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') { res.writeHead(200); res.end('ok'); return; }

  if (!timingSafeMatch(String(req.headers['x-idb-edge-secret'] || ''), EDGE_SECRET)) {
    res.writeHead(403); res.end('forbidden'); return;
  }

  if (rejectOversizedDeclaredBody(req, res)) return;

  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const slug = host.split('.')[0];
  const entry = entryFor(slug);
  if (!entry) { res.writeHead(404); res.end('unknown instance'); return; }

  const ip = clientIp(req);

  if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
    if (!rateAllowed(`public:${slug}:${ip}`, PUBLIC_RATE_PER_MINUTE)) {
      res.writeHead(429, { 'retry-after': '60' }); res.end('rate limit exceeded'); return;
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      service: 'InvisibleDB', instance: slug, status: 'ready', api: '/api',
      message: 'Connect with an InvisibleDB SDK or REST client.',
    }));
    return;
  }

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const serverKey = timingSafeMatch(bearer, entry.key);

  if (serverKey) {
    if (!rateAllowed(`management:${slug}:${ip}`, MANAGEMENT_RATE_PER_MINUTE)) {
      res.writeHead(429, { 'retry-after': '60' }); res.end('rate limit exceeded'); return;
    }
    try {
      const token = await pbTokenFor(slug, entry);
      proxyAdmin(req, res, slug, entry, token);
    } catch {
      res.writeHead(502); res.end('upstream unavailable');
    }
    return;
  }

  if (!rateAllowed(`public:${slug}:${ip}`, PUBLIC_RATE_PER_MINUTE)) {
    res.writeHead(429, { 'retry-after': '60' }); res.end('rate limit exceeded'); return;
  }

  if (bearer.startsWith('idb_live_')) {
    res.writeHead(401); res.end('invalid api key'); return;
  }

  if (blockedPublicPath(req.url)) {
    res.writeHead(403); res.end('management endpoint requires instance server key'); return;
  }

  proxyPublic(req, res, slug);
});

server.headersTimeout = 10000;
server.requestTimeout = 35000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 100;
server.listen(PORT, '0.0.0.0', () => console.log(`idb-gateway listening on :${PORT}`));
