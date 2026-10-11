# InvisibleDB JavaScript SDK

The reference SDK for InvisibleDB. Works in Node, Next.js route handlers, browsers, and React Native. Package: `@invisibledb/js` (npm). Requires Node 18.17+ (ESM).

```sh
npm install @invisibledb/js
```

## Two credential lanes

| Lane | Who | Credential |
|---|---|---|
| Trusted server | Next.js route handlers, Node, Laravel, workers | `apiKey` (instance key). Server-side only. |
| Client | Browser, React Native, Expo, anything shipped to users | End-user session via `auth.signIn`. No instance key. |

Never put an `idb_live_…` key in a browser or mobile bundle.

## Quick start

```ts
import { createClient } from "@invisibledb/js";

// Client (browser / React Native)
const idb = createClient({ url: process.env.NEXT_PUBLIC_IDB_URL! });
const { user, token } = await idb.auth.signIn({ email, password });

const open = await idb
  .from("tasks")
  .select("id,title,status")
  .eq("status", "open")
  .order("created", { ascending: false })
  .limit(20)
  .execute();

await idb.from("tasks").insert({ title: "Ship app", status: "open" });
```

```ts
// Server (trusted)
const idb = createClient({ url: process.env.IDB_URL!, apiKey: process.env.IDB_KEY });
const total = await idb.from("tasks").eq("status", "open").count();
```

## Surface

- `auth`: `signIn`, `signUp`, `signOut`, `refresh`, `currentUser`, `resetPassword`, `confirmResetPassword`, `verifyEmail`, `confirmVerifyEmail`, `setToken`, `getToken`. The PocketBase-shaped `login` is kept for existing callers.
- `from(table)`: `select`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`, `filter` (raw), `order`, `expand`, `limit`, `page`, then `execute()` (or `await`), `single`, `maybeSingle`, `count`, `get`, `insert`, `update`, `remove`.
- `collection(name)`: PocketBase-shaped `getList`, `getOne`, `create`, `update`, `delete`, `subscribe`.
- `storage`: `upload`, `url`, `signedUrl`, `remove`.
- `transaction([...])`: atomic batch of creates, updates, and deletes. The instance must have batch enabled.
- `realtime.subscribe(table, cb)`: returns an unsubscribe function. Outside browsers, pass `eventSourceImpl` or run Node with `--experimental-eventsource`.
- `vector`: `upsert`, `query`, `remove`, `status`.
- `rpc(name, params)`: call a server procedure registered on the instance. Runtime contract v1, route `/api/invisibledb/rpc/{name}`.
- `functions.invoke(name, payload)`: call a server function. Route `/api/invisibledb/functions/{name}`.

Canonical list result: `{ items, page, perPage, totalItems, totalPages }`.

## Limits

- Filter values ending in a backslash cannot be expressed in PocketBase filters. The SDK throws a `TypeError` for them.
- OAuth is not available yet. See `docs/19-sdk-matrix.md` §7.
- `rpc` and `functions` exist only on instances that run the InvisibleDB runtime hooks. Procedure names must match `^[a-z][a-z0-9_]{0,63}$`.

## Errors, timeouts, retries

Every failure throws `InvisibleDBError`:

```ts
import { InvisibleDBError } from "@invisibledb/js";

try {
  await idb.rpc("complete_task", { id });
} catch (err) {
  if (err instanceof InvisibleDBError) {
    switch (err.code) {
      case "unauthenticated": /* sign in again */ break;
      case "forbidden":       /* rule denied */ break;
      case "bad_request":     console.log(err.data); break; // per-field details
      case "timeout":
      case "network_error":   /* retry later */ break;
    }
    console.log(err.requestId); // server X-Request-Id, for support tickets
  }
}
```

`code` is one of `bad_request`, `unauthenticated`, `forbidden`, `not_found`, `conflict`, `payload_too_large`, `rate_limited`, `server_error`, `http_error`, `network_error`, `timeout`. `status` is `0` when no response arrived.

- `timeoutMs` (default 30000) applies to each attempt.
- `retry` (default 3 attempts, 250 ms base, 4000 ms cap) applies only to GET, HEAD, PUT, and DELETE. It retries network errors and 429/502/503/504 and honours `Retry-After`. POST, PATCH, `rpc`, and `functions` are never retried automatically. Pass `retry: false` to disable.

## Tests

```sh
npm run build
npm test                # offline, mocked fetch
npm run test:live       # against a live instance; see test/live.test.js for env vars
```
