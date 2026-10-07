# Gateway Implementation Spec

> **Status: specification — not yet implemented.**
> Build plan for the InvisibleDB gateway. Do not present as live until it ships.

## What it is

One service that sits in front of every project's PocketBase. It does three
jobs and nothing else: **check the key, check the user, pass the request
through.** Everything in `docs/key-architecture.md` is enforced here.

## Service choice: Hono in `packages/gateway`

Hono (Node) running as a long-lived process, managed by the existing
supervisor on our hosting boxes — the same boxes that already run PocketBase.

Why not Next route handlers in the control plane: the gateway holds
long-lived realtime connections (SSE/websocket subscriptions) and keeps a hot
key cache. Serverless functions bill per invocation and drop idle connections;
a small always-on process next to the databases is cheaper and simpler. The
control plane (Next/Vercel) stays a dashboard and account system — it never
touches data-plane traffic.

## Endpoints

All under `/v1`, per-project via subdomain or path (`your-app.invisibledb.app`
resolves the project; no project id in the URL needed).

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /v1/auth/sign-up` | `pk_*` | Create end-user, return session (access JWT + refresh token) |
| `POST /v1/auth/sign-in` | `pk_*` | Verify credentials, return session |
| `POST /v1/auth/refresh` | refresh token | Rotate: new access JWT + new refresh token, old refresh revoked |
| `POST /v1/auth/sign-out` | access JWT | Revoke refresh token |
| `POST /v1/projects/keys` | dashboard session or `sk_*` | Issue keypair (returns raw values **once**) |
| `POST /v1/projects/keys/:fp/rotate` | dashboard session or `sk_*` | Reissue; old key gets 1h grace |
| `DELETE /v1/projects/keys/:fp` | dashboard session or `sk_*` | Revoke immediately |
| `/*` (data proxy) | `pk_*` + JWT, or `sk_*` | Validate → enforce → proxy to the project's PocketBase |

## JWT

- **Algorithm:** EdDSA (Ed25519). Small keys, fast verification, no
  padding-oracle class of bugs.
- **Per-project signing keypair.** Generated at provisioning, stored encrypted
  in the control plane DB. `kid` in the JWT header identifies the key.
- **Rotation:** new keypair generated on demand; old public key honored for
  24h (overlapping validity), then retired. Access JWTs live ~1h so rotation
  is naturally bounded.
- **Claims:** `iss`, `sub` (end-user id), `prj` (project id), `typ`
  (access/refresh), `iat`, `exp`. Nothing else — no roles in v1, scoping is
  owner-based (see RLS).
- Refresh tokens are opaque random strings (not JWTs), stored hashed,
  single-use-rotating.

## Enforcement (middleware order)

1. **Resolve project** from host. Unknown host → 404.
2. **Key lookup** from `Authorization: Bearer …`. Hash, compare against cache
   (TTL ≤ 60s; revocation events pushed for immediate effect). Unknown →
   401. This also yields the key type (`pk_` vs `sk_`) — the prefix is never
   trusted on its own.
3. **Origin check** (browser requests only: `Origin`/`Referer` present).
   Not on the project's allowed-origins list → 403. Non-browser clients
   (curl, mobile, server) skip this — they authenticate instead.
4. **Session**: `pk_*` + access JWT → verify EdDSA signature, expiry,
   `prj` match. `sk_*` → full access, no JWT needed.
5. **RLS injection**: for user-scoped requests, the gateway translates the
   call into the PocketBase request with an enforced filter
   (`owner = "<JWT sub>"`). The client can never set or override `owner` —
   the gateway sets it server-side on writes and injects it on reads.
   Collection rules (`owner_only` default, `public_read`, `authenticated_read`)
   are stored per project and evaluated here, before proxying.
6. **Rate limit**: token bucket per key fingerprint (in-memory per gateway
   instance; Redis when we run more than one). Test keys get stricter limits.
7. **Proxy** to `127.0.0.1:<project port>` (PocketBase). The gateway holds the
   only route to the database; PocketBase never listens on a public port.

## Rollout

**Phase 1 — Key types + dashboard issuance.**
Developers get `pk_live_` / `sk_live_` pairs, shown once, hashed at rest.
What becomes true: no more all-powerful key in client bundles; the docs'
one snippet is safe to paste.

**Phase 2 — JWT sessions + RLS.**
`signIn` returns scoped tokens; gateway enforces owner-based row scoping.
What becomes true: a leaked publishable key can't read anyone else's data.

**Phase 3 — Origin restrictions.**
Allowed-origins list per project, enforced at the gateway.
What becomes true: someone else's site can't reuse your key in their app.

**Phase 4 — Mobile attestation.**
Play Integrity / App Attest verification for mobile clients.
What becomes true: cryptographic proof of which app is calling. Scheduled,
not claimed, until it ships.

## Explicit non-goals for v1

- No per-row sharing between users (owner-scoped only).
- No roles/permissions system in JWT claims.
- No multi-region gateway (one region, in-memory rate limiting).
- No request logging of bodies (metadata only: key fingerprint, route,
  status, latency).
- The gateway never stores end-user passwords — it verifies against the
  project's auth store and only mints tokens.
