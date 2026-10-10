# InvisibleDB + ZeroAI Architecture Lock

Status: canonical direction

## Product doctrine

InvisibleDB is not a new database engine. It is an isolated backend runtime and control plane built on proven database and infrastructure standards.

ZeroAI is not an external service, connector, or optional intelligence sidecar. ZeroAI is a native subsystem of every InvisibleDB runtime and participates directly in authorization, execution, verification, audit, memory, and deployment decisions.

## Engineering agreements

1. **Be impeccable with the contract** — publish real CPU, RAM, storage, transfer, backup behavior, and limits. Never market VPS-backed plans as dedicated physical hardware.
2. **Do not copy industry architecture by default** — adopt proven standards where they solve the problem; reject lock-in and multi-tenant application-state patterns when isolated runtimes are simpler and safer.
3. **Do not make assumptions** — rely on mature primitives such as SQL, SQLite/PostgreSQL/MySQL, KVM/provider VM isolation, Linux permissions, TLS, WAL, object storage, standard OAuth, and standard observability.
4. **Do the best engineering available at the price point** — every project must be isolated, exportable, recoverable, auditable, and operable without requiring a database administrator.

## Isolation contract

- One paid project/deployment maps to one isolated application runtime boundary.
- The provider may be InterServer first, but compute is behind a provider abstraction.
- The control plane may be shared; customer application execution and primary data state are not.
- Root access remains platform-controlled for managed cloud deployments.
- Self-host/export remains a supported exit path.

## Runtime composition

Each InvisibleDB runtime exposes:

- SQL database engine
- Auth
- Storage
- Realtime
- Vector search
- ZeroAI Core
  - ZeroMemory
  - ZeroContext
  - ZeroPolicy
  - ZeroLedger
  - ZeroGate
  - ZeroTest
  - ZeroRuntime
- Gateway adapters for approved external effects
- Continuous encrypted off-box backup/replication

## Deterministic execution rule

AI may interpret, propose, explain, and generate tests. AI is not the final authorization authority.

**AI interprets -> ZeroPolicy authorizes -> runtime executes -> ZeroLedger records -> ZeroMemory persists appropriate state.**

Irreversible writes and external effects must be explicitly classified and may require approval.

## Database CI/CD

Database state is treated as a versioned deployment artifact alongside code, policy, vector indexes, and runtime configuration.

Pipeline:

1. change proposal / git diff / agent proposal
2. change classification
3. ZeroTest white-box verification
4. ZeroTest grey-box shadow/state verification
5. ZeroTest black-box behavior verification
6. ZeroTest red-box security verification when risk requires it
7. performance gate when risk requires it
8. ZeroGate deterministic decision
9. blue/green promotion with a single authoritative writer
10. ZeroLedger records the complete lifecycle, including failures

Failed gates leave production unchanged.

## Blue/green rule

Only one environment may be the authoritative writer at a time.

For schema-changing releases, promotion requires a writer fence, final state synchronization, schema verification, then router promotion. DNS is not the deployment switch; a stable router points traffic to the active backend.

Code rollback and data rollback are different operations. Expand/contract migrations are preferred so previous application code can remain compatible with authoritative production data.

## Testing planes

- **White**: source, AST, types, schema, migration safety, SQL, policy definitions, internal contracts.
- **Grey**: API-to-database state assertions, ledger assertions, vector evaluation, gateway contract/sandbox checks.
- **Black**: public behavior from an external caller perspective with no internal implementation access.
- **Red**: adversarial verification including authorization bypass, IDOR, tenant escape, SQL injection, SSRF, prompt injection, privilege escalation, credential exfiltration, and destructive-action bypass.
- **Performance**: latency, memory, disk, startup, write queue, and query regressions.

Test depth is risk-based. UI-only changes do not require the same certification suite as schema, policy, payment, auth, or destructive changes.

## Universal integrations

Credentials are connected once at the account/organization identity layer, but authority is delegated per project/app/agent through grants.

Projects do not receive reusable OAuth refresh tokens or provider secrets. They receive integration references/capabilities and call the Invisible Gateway. ZeroPolicy evaluates every external effect before execution, and ZeroLedger records intent, decision, provider request identity, and outcome.

## Universal interpreter

InvisibleDB does not replace SQL. It exposes a schema-aware interpreter layer over SQLite/PostgreSQL/MySQL:

- typed query API
- RPC
- REST/OpenAPI
- raw SQL where appropriate
- MCP
- optional GraphQL compatibility
- ZeroQuery natural-language planning through ZeroContext + ZeroPolicy

The canonical schema graph is introspected from the actual database and versioned. SDK type artifacts may be synchronized automatically, but the platform must never claim TypeScript can infer a live runtime schema with no compile-time schema artifact.

## Provider abstraction

Compute lifecycle is represented through a provider interface rather than hard-coded InterServer behavior:

- provision
- destroy
- resize
- rebuild
- reboot
- health
- metrics
- IP/network lifecycle
- snapshot/backup hooks

InterServer is the first target because its slice economics are attractive; it is not an architectural dependency.

## Non-goals

InvisibleDB will not build its own hypervisor, TLS stack, filesystem, SQL language, OAuth protocol, or distributed consensus system unless a measured platform requirement cannot be met with mature standards.

Raft or another consensus protocol is introduced only if future requirements include leader election, multi-node replicated authority, or regional failover that cannot be achieved safely with the single-authoritative-writer model.
