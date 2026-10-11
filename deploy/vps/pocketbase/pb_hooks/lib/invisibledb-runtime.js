/// InvisibleDB runtime contract v1 — shared helpers and registries.
///
/// Loaded by pb_hooks/invisibledb.pb.js with require(`${__hooks}/lib/...`).
/// PocketBase runs each route handler in its own scope, so shared code must
/// come in through require(), not through top-level declarations.
///
/// Security rules for every handler:
///   - Unknown names return 404. The registries are not enumerable from outside.
///   - Hooks run with superuser data access, so a handler MUST authorize the
///     caller itself. Use `$app.canAccessRecord(record, requestInfo, rule)` so
///     the collection's own rules remain the source of truth.
///   - Request bodies are capped at MAX_BODY_BYTES.
///   - Handlers throw PocketBase error classes (BadRequestError, ...). They never
///     return raw database errors to the caller.

const MAX_BODY_BYTES = 64 * 1024;
const NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const RECORD_ID_RE = /^[a-z0-9]{15}$/;

function checkBodySize(e) {
  if (e.request.contentLength > MAX_BODY_BYTES) {
    throw new BadRequestError("request body too large");
  }
}

function requireId(body, field) {
  const value = body && body[field];
  if (typeof value !== "string" || !RECORD_ID_RE.test(value)) {
    throw new BadRequestError(field + " must be a record id");
  }
  return value;
}

function loadRecord(collection, id) {
  try {
    return $app.findRecordById(collection, id);
  } catch (_) {
    throw new NotFoundError("record not found");
  }
}

/// RPC registry. `auth: true` rejects anonymous callers before `run` executes.
const RPC = {
  ping: {
    auth: false,
    run: function () {
      return { ok: true };
    },
  },

  whoami: {
    auth: true,
    run: function (ctx) {
      return { id: ctx.auth.id, email: ctx.auth.getString("email") };
    },
  },

  // Example data procedure: marks a task done, but only if the caller could
  // update it under the collection's own updateRule.
  complete_task: {
    auth: true,
    run: function (ctx) {
      const id = requireId(ctx.body, "id");
      const record = loadRecord("tasks", id);
      const collection = record.collection();
      if (!$app.canAccessRecord(record, ctx.info, collection.updateRule)) {
        throw new ForbiddenError("not allowed to update this task");
      }
      record.set("status", "done");
      $app.save(record);
      return { id: record.id, status: record.getString("status") };
    },
  },
};

/// Functions registry: handlers for work that is not a plain data procedure.
const FUNCTIONS = {
  echo: {
    auth: true,
    run: function (ctx) {
      return { echo: ctx.body };
    },
  },
};

function dispatch(registry, e, kind) {
  const name = e.request.pathValue("name");
  if (!NAME_RE.test(name) || !Object.prototype.hasOwnProperty.call(registry, name)) {
    throw new NotFoundError("unknown " + kind);
  }
  const handler = registry[name];
  if (handler.auth && !e.auth) {
    throw new UnauthorizedError("authentication required");
  }
  checkBodySize(e);
  const info = e.requestInfo();
  const body = info.body || {};
  const result = handler.run({ auth: e.auth, body: body, info: info });
  return e.json(200, result === undefined ? {} : result);
}

module.exports = {
  MAX_BODY_BYTES: MAX_BODY_BYTES,
  RPC: RPC,
  FUNCTIONS: FUNCTIONS,
  dispatch: dispatch,
};
