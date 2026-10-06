# @baas-195/adapter-cpanel

Typed cPanel UAPI + WHM API client and the `createProject()` orchestration.
This package is the **only** place raw hosting-API calls live — everything
above it (supervisor, control plane) uses these typed functions and never
touches `fetch()` for hosting APIs.

## API-version pinning discipline

- `SUPPORTED_UAPI_VERSION` (`src/uapi.ts`) is pinned to the cPanel version the
  platform was built against (currently `138`).
- Every raw UAPI call funnels through the private `callUapi(module, func, params)`,
  which stamps the pinned version on the request (`X-Baas-Cpanel-Api-Version`
  header) and on the internal call ledger (`getCallLog()`).
- `assertCompatibleVersion(serverVersion)` refuses to run against a server
  reporting a NEWER major than the pin (older is fine — the pin is a ceiling,
  not a floor). UAPI exposes no version endpoint, so the check runs against an
  injected `UapiConfig.versionProbe`; on the reseller tier the sanctioned probe
  is `() => whm.getVersion()` (WHM API 1 `version`).
- A cPanel version bump = review **this package**, not the whole codebase.

## Modules

### `uapi.ts` — per-account cPanel API

| Function | UAPI call | What it does |
|---|---|---|
| `addSubdomain(sub, rootDomain, dir)` / `deleteSubdomain(fqdn)` | `SubDomain::addsubdomain` / `delsubdomain` | Project vhost lifecycle |
| `provisionDatabase(db, user, pw)` (+ granular `create/deleteDatabase`, `create/deleteDatabaseUser`, `grantAllPrivileges`) | `Mysql::*` | One prefixed DB + user per project (`<cpuser>_<name>`) |
| `installSsl({...})` / `listSslDomains()` / `waitForAutoSsl(domain)` | `SSL::install_ssl` / `list_certs` | Custom certs, or poll AutoSSL until the cert is live |
| `addCronLine(cmd, schedule?)` / `removeCronLinesMatching(match)` | `Cron::add_line` / `list_lines` + `delete_line` | Watchdog cron install/removal |
| `addFtpUser({...})` / `deleteFtpUser(user)` | `Ftp::add_ftp` / `delete_ftp` | Jailed deploy users per project |
| `readFile(dir, file)` / `writeFile(dir, file, content)` | `Fileman::get_file_content` / `save_file_content` | Small text files only — `save_file_content` goes through AdminBin IPC with a small buffer; use FTP for anything over ~100KB |

Auth: cPanel **API token** (Manage API Tokens), never a password. All calls
are POST with a form body, so passwords never land in URLs or server logs.
Secrets are scrubbed from the call ledger.

### `whm.ts` — reseller tier (Spark plan and up)

| Function | WHM call | What it does |
|---|---|---|
| `getVersion()` | `version` | Server version string — the sanctioned probe for the UAPI pin |
| `createAccount({username, domain, password, pkg})` | `createacct` | One isolated cPanel account per tenant |
| `suspendAccount(username, reason)` / `unsuspendAccount(username)` | `suspendacct` / `unsuspendacct` | Billing enforcement lever |
| `listAccounts()` | `listaccts` | All accounts under the reseller (metering / drift checks) |
| `removeAccount(username, keepDns?)` | `removeacct` | Tenant offboarding (explicit, never silent) |

Auth: WHM API token as `whm <user>:<token>` (`user` defaults to `root`;
set it to the reseller name for reseller tokens).

### `provision.ts` — `createProject()` / `deleteProject()`

`createProject(cfg, input)` runs provisioning in dependency order
(subdomain → database → db user → privileges → AutoSSL wait → watchdog cron)
and returns the `ProjectProvisioned` record the supervisor and control plane
consume.

- **Rollback:** every mutating step registers its inverse as it succeeds; on
  failure the inverses run newest-first and the throw is a `ProvisionError`
  carrying `step`, `cause`, and per-step `rollback` results. A rollback
  failure is reported, never swallowed.
- **Dry-run:** `dryRun: true` issues zero network calls — `getCallLog()` /
  the returned `callLog` IS the provisioning plan, every entry stamped with
  the pinned API version.
- **SSL wait** is side-effect free: a timeout sets `sslPending: true` and
  provisioning continues (set `failOnSslTimeout: true` to make it fatal).
- `deleteProject(cfg, {name, domain, ...})` tears down in reverse order,
  best-effort: every step is attempted, failures are reported in the
  `TeardownReport`, never thrown.

## Errors (`src/errors.ts`)

`UapiError` (module/func/httpStatus), `WhmError` (func/httpStatus),
`VersionMismatchError` (pinned vs reported), `ProvisionError`
(step/cause/rollback[]).

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsc → dist/
npm test            # compile tests → node --test (mocked fetch, no live calls)
```

Tests live in `test/` (`node:test` + `node:assert/strict`, `test/helpers.ts`
provides the mock-fetch router). There are no live-connection tests by
design — no credentials exist for that yet. When they do, add an
integration suite gated behind an env flag, never in the default run.

## Live-test finding (2026-10-05, OrangeHost server306)

Full `createProject` → `deleteProject` smoke test run live: subdomain ✓, MySQL db/user/privileges ✓, SSL step ✓ — then failed at the `cron` step because the **server's `Cpanel::API::Cron` Perl module is missing** (`Can't locate Cpanel/API/Cron.pm`). This is an OrangeHost server-side issue, not an adapter bug.

Critically, the failure proved the rollback path for real: all 5 created resources were torn down automatically, zero leftovers verified via list calls.

**Implication:** do not depend on UAPI Cron on this host. The supervisor's global watchdog needs exactly one cron line — install it once via `bin/install.sh` (which merges `crontab` directly) or the cPanel Cron Jobs UI, and treat the adapter's per-project cron step as deprecated (see supervisor's global-watchdog design).
