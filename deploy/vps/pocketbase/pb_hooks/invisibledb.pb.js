/// InvisibleDB runtime contract v1 — routes and triggers.
///
/// Runs inside the per-customer PocketBase process (JS hooks, `pb_hooks/`).
/// The SDKs call these routes; the contract is runtime-agnostic, so a future
/// Next.js runtime can serve the same paths without an SDK change.
///
///   POST /api/invisibledb/rpc/{name}        typed procedures (data-oriented)
///   POST /api/invisibledb/functions/{name}  side-effecting handlers
///   triggers: onRecord* hooks, declared below
///
/// Registries and security rules live in lib/invisibledb-runtime.js.

routerAdd("POST", "/api/invisibledb/rpc/{name}", (e) => {
  const runtime = require(`${__hooks}/lib/invisibledb-runtime.js`);
  return runtime.dispatch(runtime.RPC, e, "rpc");
});

routerAdd("POST", "/api/invisibledb/functions/{name}", (e) => {
  const runtime = require(`${__hooks}/lib/invisibledb-runtime.js`);
  return runtime.dispatch(runtime.FUNCTIONS, e, "function");
});

/// Triggers. Applied on every create to the tasks collection. Example only:
/// a business default that the database layer should own, not each client.
onRecordCreate((e) => {
  if (!e.record.getString("status")) {
    e.record.set("status", "open");
  }
  e.next();
}, "tasks");
