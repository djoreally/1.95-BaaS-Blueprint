# 19 — SDK Matrix & Conformance

**Status:** 2026-10-11 · Living doc. Each cell is one of: ✅ verified against a live instance · 🔍 built, verified only by unit tests or CI, not against a live instance · ⚠️ partial · ❌ missing.

## 1. Summary

- **`@invisibledb/js` 0.2.0 is the reference SDK** (`packages/sdk-js`). Verified against PocketBase 0.36.5 on a fresh, seeded data directory: **22/22 live conformance tests** and **46 offline tests** pass. Live rpc, functions, and error-code paths run against the runtime hooks in `deploy/vps/pocketbase/pb_hooks`.
- **Kotlin and Swift:** the defects found by static review are fixed in source, and each SDK has a unit test suite (JDK `HttpServer` stub, `URLProtocol` mock). **Neither has been compiled or run yet.** Their first real run is the CI job in `.github/workflows/sdk-ci.yml`. Neither SDK is "supported" until it passes the shared live suite (§6).
- **Dart:** unchanged in this pass. Server-key only, with no end-user login, no realtime, and no transactions. CI runs its existing `dart test`.
- **Not started:** PHP (Laravel), Python, Go, .NET, and the React Native adapter. CI has **no PHP job**, because no PHP SDK exists yet.
- **Backend:** `rpc` and `functions.invoke` are served by PocketBase JS hooks on stable routes. The Next.js server runtime from the thesis is still an open decision (§8).

## 2. How this was verified

- **Runtime:** PocketBase **0.36.5**, the version pinned in `deploy/vps/pocketbase/Dockerfile`. Taken from the PyPI `pocketbase-bin` wheel and run on `127.0.0.1` in the sandbox. This is **not** the production box. Test data and credentials are outside the repo, in `/home/user/pb-test`.
- **Seeding:** `scripts/sdk-conformance/seed-pocketbase.py` (stdlib Python, idempotent). It creates the `tasks` collection with the autodate fields, the `owner` relation, public list/view, and authenticated write. It also creates the user and sets batch on or off. CI runs the same script.
- **Hooks:** `pocketbase serve --hooksDir=deploy/vps/pocketbase/pb_hooks`. The default hooks directory is `cwd/pb_hooks`, which is `/pb/pb_hooks` in the image, because `WORKDIR` is `/pb`. Verified locally.
- **Commands:**
  - `cd packages/sdk-js && npm run build && npm test` (offline)
  - `npm run test:live` with `INVISIBLEDB_LIVE_URL`, `_EMAIL`, and `_PASSWORD` set (live, Node 22)
- **Not verified here:** the Docker image build (no Docker in the sandbox), Kotlin, Swift, and Dart (no toolchains and no Maven or SwiftPM access). These run in CI.

## 3. Platform facts the audit established (these bind every SDK)

1. **Filter literals.** PocketBase reads a backslash as a plain character. Only `\"` is an escape. `JSON.stringify` is therefore wrong for filters. Wrap the value in double quotes and escape `"` as `\"`. A value that ends in a backslash cannot be expressed. Bound filter parameters are rejected over REST (HTTP 400). Each SDK's filter builder must follow this rule and reject trailing-backslash values locally.
2. **Autodate fields are not automatic.** A collection created through the API gets no `created` or `updated`. Sorting by `created` returns 400. Provisioning must add them to every collection.
3. **Batch is disabled by default.** `POST /api/batch` returns 403. Enabling it is a `PATCH /api/settings` call with the superuser token. The gateway blocks `/api/settings` on the public lane, so this happens at provisioning.
4. **Removing one file.** `PATCH` with `{"field-": ["name.txt"]}` removes that file. An empty string clears the whole field.
5. **Rule-denied writes return 400, not 403.** A create that fails its rule returns `400 "Failed to create record."` SDKs must not assume 403. The runtime's own `complete_task` route returns a real 403 when `canAccessRecord` denies it.
6. **No account enumeration.** `request-password-reset` and `request-verification` return 204 for unknown emails.
7. **Signed file URLs work.** `POST /api/files/token` returns a token for `?token=`.
8. **Gateway lanes** (`deploy/vps/gateway/gateway.js`). The public lane blocks `/api/settings`, `/api/collections/_superusers`, `/api/backups`, and `/api/vector/{upsert,delete,status}`, and allows everything else. `/api/invisibledb/*` is therefore reachable on the public lane **without a gateway change**.
9. **Hooks load rules** (PocketBase 0.36.5 JSVM). Route handlers cannot see top-level `const` or `function` declarations in the hook file. Shared code must come through `require(`${__hooks}/lib/...`)` inside the handler. A bare `throw` becomes a generic 400, so handlers must use `BadRequestError`, `ForbiddenError`, `NotFoundError`, and `UnauthorizedError`.

## 4. Universal surface × SDK

| Surface | JS 0.2.0 (ref) | Swift | Kotlin | Dart |
|---|---|---|---|---|
| `health` | ✅ | 🔍 | 🔍 | 🔍 |
| `auth.signUp` | ✅ | ❌ | ❌ | ❌ |
| `auth.signIn` (password) | ✅ | ⚠️ `authWithPassword` | ⚠️ `authWithPassword` | ❌ |
| `auth.signOut` | ✅ | ⚠️ `logout` | ⚠️ `logout` | ❌ |
| `auth.refresh` / `currentUser` | ✅ | ❌ | ❌ | ❌ |
| `auth.resetPassword` / `verifyEmail` | ✅ | ❌ | ❌ | ❌ |
| `auth` OAuth2 | ❌ (§7) | ❌ | ❌ | ❌ |
| Anonymous read of a public collection | ✅ | 🔍 (fixed) | 🔍 (fixed) | ❌ (key required) |
| Query builder (`select/eq/…/order/limit/expand`) | ✅ | ❌ (`getList` params only) | ❌ (`getList` params only) | ❌ |
| `single / maybeSingle / count` | ✅ | ❌ | ❌ | ❌ |
| CRUD (`get/insert/update/remove`) | ✅ (honours `select` and `expand`) | 🔍 `getOne/create/update/delete` | 🔍 `getOne/create/update/delete` | ⚠️ same names, no auth |
| Collection handle | ✅ `collection(t)` | 🔍 `RecordCollection` (renamed) | 🔍 `RecordCollection` (renamed) | 🔍 |
| Relationships (`expand`) | ✅ (live C18) | ❌ | ⚠️ `getList(expand=)` only | ❌ |
| `realtime.subscribe` | ✅ (unsubscribe fn) | ❌ | ❌ | ❌ |
| `storage.upload / url / signedUrl / remove` | ✅ | ⚠️ `fileUrl` | ⚠️ `fileUrl` | ⚠️ `fileUrl` |
| `vector.upsert / query / remove` | 🔍 (`status` not run; stock binary has no sqlite-vec) | ⚠️ `vectorQuery` | ⚠️ `vectorQuery` | ⚠️ `query` |
| `transaction` (batch) | ✅ (enabled and disabled) | ❌ | ❌ | ❌ |
| `rpc` | ✅ (live C15) | 🔍 `rpc(_:params:)` | 🔍 `rpc(name, params)` | ❌ |
| `functions.invoke` | ✅ (live C16) | 🔍 `functions.invoke` | 🔍 `functions.invoke` | ❌ |
| Error `code` (shared table) | ✅ | 🔍 `Code` enum | 🔍 `ErrorCode` enum | ❌ |
| Timeout / bounded retry (idempotent only) | ✅ | 🔍 | 🔍 | ❌ |
| Client-lane rule (no server key in client code) | ✅ documented | ✅ | ✅ | ❌ (constructor requires `apiKey`) |

- **JS:** every ✅ cell is checked by a live or offline test. Dart and Swift cells are from static reading or unit tests only.
- **🔍 cells:** the code is written and unit-tested, or it compiles in CI. Neither is a live run.

## 5. Defects and fixes in the non-reference SDKs

**Kotlin** (`packages/sdk-kotlin`)
- *Fixed:* `req<T>` cast `JSONObject` to `Map`, which threw `ClassCastException` on every JSON read. JSON is now converted to plain Kotlin maps and lists.
- *Fixed:* query values were not encoded. They now use form encoding. Path ids and segments use `%20` encoding.
- *Fixed:* `authHeader()` threw without credentials. Anonymous reads now send no `Authorization` header.
- *Fixed:* `Collection` shadowed `kotlin.collections.Collection`. Renamed to `RecordCollection`.
- *Added:* `ErrorCode`, timeouts, bounded retry for idempotent methods, `rpc`, and `functions.invoke`.
- *Tests:* `src/test/kotlin/invisibledb/InvisibleDBTest.kt`, 15 tests on a JDK `HttpServer` stub.
- *Not verified:* compilation. The Gradle build targets JDK 17 and Gradle 8.10.2 in CI, and Kotlin 1.9.22.

**Swift** (`packages/sdk-swift`)
- *Fixed:* `authHeader()` threw without credentials. Anonymous reads now work.
- *Fixed:* public `Collection` shadowed `Swift.Collection`. Renamed to `RecordCollection`.
- *Fixed:* record ids and file names were not percent-encoded. Path segments and query values now use strict encoding.
- *Fixed:* `URLComponents(string:)!`, `comps.url!`, and the `as!` casts were force unwraps. They now throw `InvisibleDBError`.
- *Added:* `Code` enum, timeouts, bounded retry for idempotent methods, `rpc`, and `functions.invoke`.
- *Tests:* `Tests/InvisibleDBTests/InvisibleDBTests.swift`, 14 XCTest cases with a `URLProtocol` mock.
- *Not verified:* compilation. The CI job runs `swift test` on macOS 14.

**Dart** (`packages/sdk-dart`): unchanged in this pass. Its client-lane problem is still open. The constructor requires `apiKey`, so a Flutter client would have to ship the server key. The fix is end-user auth, which is planned, not built.

## 6. Conformance suite

The shared suite is the **live test list in `packages/sdk-js/test/live.test.js`**. The JS SDK passes all 22 tests against the seeded PocketBase 0.36.5 instance. To be called **supported**, another SDK must pass the same scenarios against the same seeded instance from its own CI job. The Kotlin and Swift jobs run only their unit suites today. **No SDK other than JS is certified yet.**

| ID | Scenario | JS |
|---|---|---|
| C01 | health reachable without credentials | ✅ |
| C02 | anonymous read of a public collection (no `Authorization`) | ✅ |
| C03 | signIn returns user and token; signOut clears them | ✅ |
| C04 | wrong password returns a 4xx error | ✅ |
| C05 | anonymous write is rejected (permissions) | ✅ |
| C06 | insert → get → update → remove round trip | ✅ |
| C07 | query semantics: eq, neq, in, contains, order, limit, projection, count | ✅ |
| C08 | filter literal escaping: quotes and backslashes survive | ✅ |
| C09 | invalid identifiers rejected locally, with no request sent | ✅ |
| C10 | file upload, public URL, signed URL, removal | ✅ |
| C11 | signUp creates an account and signs in | ✅ |
| C12 | password reset resolves for unknown emails | ✅ |
| C13 | transaction: atomic when batch is enabled, clean 403 when disabled | ✅ |
| C14 | realtime create event delivered to a subscriber | ✅ |
| C15 | rpc reaches the runtime; anonymous call → `unauthenticated`; unknown procedure → `not_found` | ✅ |
| C16 | functions.invoke echoes the payload for a signed-in user | ✅ |
| C17 | error codes: invalid input → `bad_request`; unknown record → `not_found`; timeout → `timeout` | ✅ |
| C18 | relationships: relation field stores the id; `expand` resolves it | ✅ |

C05 uses the default rule, and C13 accepts both the enabled and the disabled batch state.

The offline suite covers the same surface with a mocked `fetch`. It checks the compiler output, local rejection of trailing-backslash values, multipart bodies, the credential rules, the retry policy, `Retry-After`, error codes, and rpc name validation.

## 7. Gaps and what the runtime still needs

- **`rpc` and `functions`.** These now run as PocketBase JS hooks. They are not yet deployed. The Dockerfile `COPY pb_hooks` lines are in both `Dockerfile` and `Dockerfile.vec`, but the image has not been built here, and the existing boxes need an image rebuild. Their current contract is intentionally small: the rpc procedures are `ping`, `whoami` (auth required), and `complete_task` (auth required, ownership enforced by the collection rule), and the only function is `echo`. Long-term procedure registration is part of the backend-contract work.
- **Triggers and jobs.** Only one trigger exists: `tasks` gets `status = "open"` when it is blank. There are no jobs. Webhooks are not started.
- **OAuth2.** Not implemented in any SDK. It needs PocketBase's `auth-with-oauth2` flow and a redirect handler per platform.
- **Vector writes.** `upsert`, `delete`, and `status` are blocked on the public lane by design. The stock binary has no sqlite-vec, so vector calls were not run live.
- **Batch.** Off by default. Provisioning has to enable it.
- **Autodate.** Provisioning has to add `created` and `updated` to every collection.

## 8. Decisions and build order

Decisions taken in this pass (the user has not yet confirmed them):
- Package name `@invisibledb/js`. Confirmed free on npm.
- Canonical list shape `{items, page, perPage, totalItems, totalPages}`.
- rpc and functions run as PocketBase JS hooks behind stable routes `/api/invisibledb/rpc/{name}` and `/api/invisibledb/functions/{name}`. The Next.js server runtime is still the thesis target. It stays open.
- CI: one workflow, `.github/workflows/sdk-ci.yml`. Jobs: JS offline on Node 20 and 22, JS live on Node 22 against a seeded PocketBase, Kotlin/JVM on JDK 17, Swift on macOS 14, and Dart `dart test`. **No PHP job**, because there is no PHP SDK. Actions are pinned to commit SHAs.
- User-Agent is not set in the JS SDK. Browsers forbid it. `X-Request-Id` is not sent as a request header, because a custom header would trigger a CORS preflight. The server's id is read back from responses.

Open decisions:
1. Whether a rule-denied write should map to `forbidden` in the SDK. The server returns 400 today, so the code is `bad_request`.
2. Whether to defer OAuth until the browser redirect flows are designed.
3. Whether the Next.js server model replaces PocketBase hooks as the rpc and functions runtime.

Build order from here:
1. **JS** (done, §6).
2. **Swift and Kotlin:** their first CI runs. Fix what fails. Then run C01–C18 against the seeded instance in each job.
3. **Dart:** end-user auth, realtime, storage, and transactions. Then C01–C18.
4. **New:** PHP (Laravel), Python, Go, and .NET. Then React Native (the JS core with an EventSource polyfill and a secure token store).

Each SDK's filter encoder must follow §3.1.

## 9. Toolchains and CI

- **Sandbox:** Node 22 and Python 3.11. No Swift, JDK, Kotlin, Dart, PHP, Go, Docker, or .NET. Those are verified in CI only.
- **CI:** `.github/workflows/sdk-ci.yml` runs JS offline (Node 20 and 22), JS live (Node 22, seeded PocketBase, throwaway credentials per run), Kotlin/JVM (JDK 17), Swift (macOS 14), and Dart. It has not been run yet. Its first run is the next step.
- **Not in CI:** PHP, Python, Go, and .NET, because those SDKs do not exist yet.
