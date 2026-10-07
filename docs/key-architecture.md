# InvisibleDB Key Architecture

> **Status: specification — not yet implemented.**
> This document is the build plan for InvisibleDB's key system. Do not present
> these controls as live until the gateway ships. (No evidence, no green.)

## Vision

Stop over-complicating it. A developer gives us an email address, we provision
an isolated, secure SQLite database in the cloud instantly. We handle the auth,
we handle the files, we handle the vector embeddings natively. They paste one
snippet, handle their API key via an environment variable, and go back to
building their actual app features.

This spec makes sure that one snippet is safe to paste.

## The problem it solves

Client-facing SDKs (web, mobile) ship code to devices the developer doesn't
control. A single all-powerful API key in that bundle means anyone who extracts
it can read, write, and delete everything. The fix is the industry-standard
split: a **publishable key** that's safe in public code, and a **secret key**
that never leaves the server.

## Key types

| Key | Prefix | Safe in client bundles? | Scope |
|-----|--------|------------------------|-------|
| Publishable (live) | `pk_live_` | Yes | Auth endpoints + data scoped to the signed-in user |
| Publishable (test) | `pk_test_` | Yes | Same, against the project's test environment |
| Secret (live) | `sk_live_` | **No — server only** | Everything: admin, schema, user management, all data |
| Secret (test) | `sk_test_` | **No — server only** | Same, against the test environment |

### Format and generation

- 64 hex characters of output from a CSPRNG (`crypto.getRandomValues` /
  `crypto.randomBytes`), prefixed for identification: `pk_live_` + 64 chars.
- The prefix is **not** a security boundary — it's for humans and logs. The
  gateway identifies key type from a stored, hashed record, never by trusting
  the prefix alone.
- Stored **hashed at rest** (SHA-256 HMAC of the raw key with a server-side pepper;
  keys are high-entropy, so no slow hash needed). Only the hash is stored; the
  raw value is shown **once** at creation and never retrievable again.
- Last-4-characters fingerprint stored alongside for dashboard identification
  ("…a3f9").

### Capability matrix

| Operation | `pk_*` (no session) | `pk_*` + signed-in JWT | `sk_*` |
|-----------|:---:|:---:|:---:|
| `auth.signUp` / `auth.signIn` | ✅ | ✅ | ✅ |
| Read own rows | ❌ | ✅ | ✅ |
| Write own rows | ❌ | ✅ | ✅ |
| Read other users' rows | ❌ | ❌ (unless collection rule allows) | ✅ |
| Public-read collections | ✅ (read only) | ✅ (read only) | ✅ |
| Create/drop collections (schema) | ❌ | ❌ | ✅ |
| Manage users (list, ban, delete) | ❌ | ❌ | ✅ |
| Rotate/revoke keys | ❌ | ❌ | ✅ (or dashboard session) |
| Vector embed/query | ❌ | ✅ (scoped like reads) | ✅ |

Default posture: **deny**. A publishable key with no session can do nothing
except hit auth endpoints and read collections explicitly marked public-read.

## Session flow

1. Developer initializes the client with the publishable key:
   ```ts
   const db = new InvisibleDB({
     baseUrl: 'https://your-app.invisibledb.app',
     publishableKey: 'pk_live_...', // safe in client bundles — user-scoped only
   });
   ```
2. `await db.auth.signIn(email, password)` → the gateway verifies credentials
   against the project's auth store and returns:
   - a short-lived **access JWT** (~1 hour), and
   - a longer-lived **refresh token** (~30 days, rotating, revocable).
3. Every data call carries the access JWT. The gateway validates the signature
   and enforces row-level scoping from the claims (see RLS below).
4. On expiry, the SDK silently uses the refresh token to get a new access JWT.
   Refresh tokens are single-use-rotating: each refresh invalidates the old one,
   so a stolen refresh token is detectable on reuse (both get revoked).

### JWT claims

```json
{
  "iss": "https://gateway.invisibledb.app",
  "sub": "usr_abc123",
  "prj": "prj_xyz789",
  "typ": "access",
  "iat": 1790000000,
  "exp": 1790003600
}
```

- `sub`: the end-user id. All RLS scoping keys off this.
- `prj`: the project id. Tokens never cross projects.
- Signed per-project (see gateway spec for key management).

## RLS model

- **Default-deny.** Every row is owned by a user id (`owner` column, set by the
  gateway on write from the JWT `sub` — never client-supplied).
- A signed-in request may read/write only rows where `owner = JWT.sub`.
- **Collection rules** (dashboard-configured, stored per project):
  - `public_read`: anyone (even without a session) may read, never write.
  - `owner_only` (default): as above.
  - `authenticated_read`: any signed-in user may read, only owners may write.
- The secret key bypasses RLS — it's the backend's escape hatch for jobs,
  migrations, and admin tooling. That's why it must never ship in client code.

## Origin protection

- **Web:** per-project allowed-origins list in the dashboard. The gateway checks
  `Origin` (preferred) / `Referer` on browser requests and rejects anything not
  on the list with a 403. Empty list = deny all browser traffic (safe default);
  the dashboard onboarding prompts the developer to add their domain.
- **Mobile:** honest statement — a publishable key extracted from an app binary
  cannot escalate (short-lived JWTs + per-user scoping contain it), but we
  cannot cryptographically prove which app is calling yet. OS-level app
  attestation (Play Integrity on Android, App Attest on iOS) is **scheduled,
  not claimed** — see gateway spec Phase 4.

## Rotation and revocation

- Dashboard and API: rotate (issues a new key, old key gets a configurable
  grace period, default 1 hour) or revoke immediately.
- Revocation propagates to the gateway's key cache within seconds (cache TTL ≤
  60s; revocation events pushed, not just polled).
- Compromised secret key: one-click "revoke and reissue" — new `sk_live_*`
  shown once, old hash deleted.
- Audit log: every issuance, rotation, and revocation is recorded with actor,
  timestamp, and key fingerprint.

## Test vs live

- Test keys (`pk_test_` / `sk_test_`) hit an isolated namespace: separate
  database file, separate signing keys, data clearly labeled non-production.
- Promoting to live is explicit — test data never leaks into the live project.
- Rate limits are stricter on test keys (abuse containment).

## What this spec does not cover

- The gateway service itself — see `docs/gateway-implementation.md`.
- Billing/metering hooks on key usage (future).
- Fine-grained per-row sharing between users (future; v1 is owner-scoped).
