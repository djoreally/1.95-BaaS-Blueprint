# Changelog

All notable changes to `@invisibledb/js` are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## 0.2.0

### Breaking
- Package renamed from `invisibledb` to `@invisibledb/js`.

### Added
- `rpc(name, params)` calls a server procedure at `/api/invisibledb/rpc/{name}`.
- `functions.invoke(name, payload)` calls a server function at `/api/invisibledb/functions/{name}`.
- `InvisibleDBError.code` with stable values: `bad_request`, `unauthenticated`, `forbidden`,
  `not_found`, `conflict`, `payload_too_large`, `rate_limited`, `server_error`, `http_error`,
  `network_error`, `timeout`. Exported `ErrorCode` type and `codeForStatus()` helper.
- `InvisibleDBError.requestId` from the server `X-Request-Id` response header.
- `timeoutMs` option (default 30000) applied per attempt through `AbortController`.
- `retry` option: idempotent requests (GET, HEAD, PUT, DELETE) retry network errors and
  429/502/503/504 with capped, jittered exponential backoff that honours `Retry-After`.
  Defaults: 3 attempts, 250 ms base, 4000 ms cap. Pass `retry: false` to disable.

### Changed
- Non-idempotent calls (POST, PATCH, rpc, functions) are never retried automatically.
- Requests that fail without a response throw `InvisibleDBError` with status `0` instead of
  a raw `TypeError`.
- Package metadata for publishing: `files`, `engines` (Node >= 18.17), `sideEffects: false`,
  `repository`, `publishConfig` with provenance, and corrected `exports` condition order.

## 0.1.0

- Initial SDK: auth, collections, realtime, files, vectors, transactions.
