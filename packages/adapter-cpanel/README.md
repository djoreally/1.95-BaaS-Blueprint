# @baas-195/adapter-cpanel

Typed cPanel UAPI + WHM API client and the `createProject()` orchestration.
This package is the **only** place raw hosting-API calls live.

## API-version pinning discipline

- `SUPPORTED_UAPI_VERSION` (`src/uapi.ts`) is pinned to the cPanel version the
  platform was built against (currently `138`).
- A cPanel version bump = review **this file**, not the whole codebase.
  The adapter isolates every raw call so a breaking change is a one-file fix.
- Watch the [cPanel & WHM Developer Portal](https://api.docs.cpanel.net/) changelog;
  building on their versioned, documented API surface is a sanctioned
  integration path — not a hack (see `docs/14-control-plane.md`).

## Modules

### `uapi.ts` — per-account cPanel API

| Function | UAPI call | What it does |
|---|---|---|
| `addSubdomain(subdomain, rootDomain, dir)` | `SubDomain::addsubdomain` | Creates `project.example.com` → `public_html/<dir>` |
| `createDatabase(dbName, dbUser, dbPassword)` | `Mysql::create_database` + `create_user` + `set_privileges_on_database` | One prefixed DB + user per project (`<cpuser>_<name>`) |
| `waitForAutoSsl(domain, timeoutMs)` | `SSL::list_certs` (poll) | Waits for AutoSSL to issue the cert for a new vhost |
| `addCronLine(command, minute)` | `Cron::add_line` | Installs the watchdog cron (default every 5 min) |

Auth: cPanel **API token** (Manage API Tokens), never a password.

### `whm.ts` — reseller tier (Spark plan and up)

| Function | WHM call | What it does |
|---|---|---|
| `createAccount({username, domain, password, pkg})` | `createacct` | One isolated cPanel account per tenant |
| `suspendAccount(username, reason)` / `unsuspendAccount(username)` | `suspendacct` / `unsuspendacct` | Billing enforcement lever |
| `removeAccount(username)` | `removeacct` | Tenant offboarding (explicit, never silent) |

### `index.ts` — `createProject()`

Runs the provisioning calls in dependency order
(subdomain → database → watchdog cron → SSL wait) and returns the
`ProjectProvisioned` record the supervisor and control plane consume.

## TODO

- [ ] `api.version` handshake: refuse to run when the server reports a newer
      major than `SUPPORTED_UAPI_VERSION` (currently assumed, not enforced).
- [ ] Retry/backoff wrapper for transient UAPI failures.
- [ ] `deleteProject()` — teardown in reverse order for clean offboarding.
