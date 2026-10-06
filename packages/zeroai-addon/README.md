# @baas-195/zeroai-addon

**ZeroAI is not an AI model. It is the deterministic operating system around AI models.**

The model reasons. This package controls **state, execution, permissions, memory, evidence, and certification** — the agent OS that ships with every InvisibleDB seat.

> Inference proposes. Deterministic systems decide. Evidence proves.
> Memory preserves. Policy authorizes.

## The five planes

| Plane | This package | Responsibility |
|---|---|---|
| Control | `types.ts` (IntentContract, TaskGraph) | Typed intent contracts, dependency-ordered task graphs |
| Instruction | `types.ts` (AgentDefinition) | Agents as capabilities: tools, schemas, instruction sets |
| Execution | your runtime | Runs tools/APIs — ZeroAI constrains *what may run* |
| Memory | `memory.ts` (ZeroMemory) | Fact graph, salience, dedupe, compaction to a byte budget |
| Observation | `ledger.ts` (ZeroLedger) | Hash-chained, tamper-evident event log |

Plus the enforcement layer: `policy.ts` (ZeroPolicy permission broker), `gates.ts` (ZeroGate lifecycle gates), `cert.ts` (ZeroCert evidence-driven certification).

## Quick start

```ts
import { ZeroMemory, ZeroLedger, ZeroPolicy, defaultPolicyRules } from '@baas-195/zeroai-addon';

// Memory: the agent remembers without replaying chat history.
const memory = new ZeroMemory();
await memory.remember('user timezone is America/New_York', 'identity', { key: 'user.timezone' });
await memory.remember('deploy target is production', 'facts', { key: 'deploy.target' });
const context = await memory.activeMemory(); // ≤192 KB of highest-salience facts

// Ledger: every meaningful action leaves a tamper-evident trail.
const ledger = new ZeroLedger();
ledger.append({ workspaceId: 'ws-1', actor: 'backend', action: 'WRITE', input: { table: 'orders' } });
console.log(ledger.verify()); // { valid: true }

// Policy: the model requests authority; the broker decides.
const policy = new ZeroPolicy();
for (const rule of defaultPolicyRules()) policy.addRule(rule);
policy.check({ agent: 'backend', action: 'READ', environment: 'production' }); // true
policy.check({ agent: 'backend', action: 'CHARGE_CARD', environment: 'production' }); // 'approval-required'
```

## How it plugs into an InvisibleDB seat

Each seat provisions two things:

1. **The data layer** — PocketBase (auth, realtime DB, file storage, vector search).
2. **The agent OS** — this package, backed by the seat's own storage:
   - `ZeroMemory` persists the fact graph (swap `InMemoryStore` for a Postgres-backed `MemoryStore`).
   - `ZeroLedger` persists the event chain (`export()`/`import()` round-trip a verifiable log).
   - `ZeroPolicy` loads the seat's policy rules; agents request, the broker decides.
   - `ZeroGate` guards transitions (deployments, releases) on evidence, not model opinion.
   - `ZeroCert` certifies requirements from evidence — no evidence is `UNKNOWN`, never success.

Canonical state lives outside inference: database, event ledger, task graph, artifacts, evidence, memory graph, policies. The AI receives a projection of that state. It does not become the state.

## API overview

- `orderTaskGraph(graph)` — topological sort; throws on cycles/unknown deps.
- `ZeroMemory.remember/recall/forget/compact/activeMemory`
- `ZeroLedger.append/verify/export/import`, `canonical`, `sha256Hex`
- `ZeroPolicy.addRule/decide/check`, `PolicyDeniedError`, `defaultPolicyRules()`
- `evaluateGateSet`, `contextGate`, `softwareReleaseGates()`, `gatePassed`
- `ZeroCert.certify/get/all/summary/allVerified`

## Tests

```sh
npm test   # tsc build + node --test, 27 tests
```

## License

Apache-2.0 — the recipe is open. See [LICENSE](./LICENSE).
