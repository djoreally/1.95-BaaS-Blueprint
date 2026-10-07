# InvisibleDB — Agent Guide

> This document is written for AI agents (Muse, Claude Code, and friends).
> If you are a human, start at [baas.innovarel.dev](https://baas.innovarel.dev).
> If you are an agent, this is your operating manual.

## What InvisibleDB is

InvisibleDB is a hosted backend-as-a-service: each seat provisions an isolated
backend instance (auth, realtime database, file storage, admin UI, built-in
vector search) that you talk to over REST or the Dart SDK. You never see the
infrastructure — no servers, no DevOps, no surprise bills. Your data lives in
SQLite files you can export and take anywhere.

## The agent-native framing

Firebase gives your agents a database. **InvisibleDB gives them a memory and
a conscience.**

Every seat ships two layers:

1. **The data layer** — PocketBase: collections, auth, realtime subscriptions,
   file storage, vector search. This is what your app talks to.
2. **The agent OS** — ZeroAI (`packages/zeroai-addon`): deterministic
   infrastructure around inference. Memory that persists across sessions,
   a tamper-evident audit ledger, a permission broker, and lifecycle gates.
   State lives outside inference, on infrastructure you control.

The rule that governs everything here:

> **Inference proposes. Deterministic systems decide. Evidence proves.**

## Provisioning

You have two interfaces. Both program against the same `InvisibleDBClient`
contract (`packages/mcp-server/src/client.ts`). Pick whichever your runtime
supports.

### Via MCP (preferred for conversational agents)

Add the server to your MCP client (Claude Code `.mcp.json` or Claude Desktop
config — see `packages/mcp-server/README.md`):

```json
{
  "mcpServers": {
    "invisibledb": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "INVISIBLED_API_URL": "https://baas.innovarel.dev",
        "INVISIBLED_API_KEY": "<your-key>"
      }
    }
  }
}
```

Tools: `idb_provision`, `idb_list`, `idb_keys`, `idb_query`, `idb_gate_check`.

### Via CLI (preferred for scripts and terminals)

```bash
export INVISIBLED_API_URL="https://baas.innovarel.dev"
export INVISIBLED_API_KEY="<your-key>"

idb init            # wizard: name -> provisions
idb list            # instances with honest status
idb keys <instance> # API keys + Dart/curl snippets (secret — don't share)
idb status          # control plane health
```

An instance in `provisioning` is **not ready**. Poll `idb list` until it
says `ready`. Never claim an instance works before then.

## Querying data

Get keys first (`idb_keys` / `idb keys`), then use them. Two paths:

**Dart (Flutter) — first-class:**

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('https://<instance>.invisibledb.io');
pb.authStore.save('<api-key>', null);

final notes = await pb.collection('notes').getFullList(
  filter: 'done = false',
);
```

**REST (any runtime):**

```bash
curl "https://<instance>.invisibledb.io/api/collections/notes/records?filter=done%3Dfalse" \
  -H "Authorization: Bearer <api-key>"
```

**Vector search** (built in — no Pinecone account):

```bash
curl -X POST "https://<instance>.invisibledb.io/api/vector/query" \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{"collection": "docs", "vector": [0.12, -0.03, "..."], "k": 5}'
```

The API key is a secret. Never log it, never paste it into tickets, issues,
or prompts beyond the session that needs it.

## ZeroAI addon patterns

`packages/zeroai-addon` (`@baas-195/zeroai-addon`) is the deterministic OS.
Use these four primitives; don't reinvent them.

### 1. Memory — `ZeroMemory`

Persist facts across sessions instead of replaying chat history. The smallest
sufficient state wins.

```ts
import { ZeroMemory } from '@baas-195/zeroai-addon';

const memory = new ZeroMemory();
await memory.remember(
  'Customer prefers weekly fleet reports on Mondays',
  'facts',
  { key: 'fleet-report-cadence', salience: 0.8 },
);
```

Categories: `identity`, `projects`, `facts`, `recent`, `patterns`, `issues`,
`reserve`. Duplicates bump salience; conflicts supersede (history preserved).

### 2. Ledger — `ZeroLedger`

Every meaningful agent action leaves a hash-chained, tamper-evident event.
Inputs/outputs are hashed, never stored raw.

```ts
import { ZeroLedger } from '@baas-195/zeroai-addon';

const ledger = new ZeroLedger();
ledger.append({
  workspaceId: 'acme-crm',
  actor: 'agent:backend',
  action: 'provision_instance',
  input: { name: 'acme-crm' },
  output: { instanceId: 'inst_1', status: 'ready' },
  evidenceRefs: ['uapi-call-log:9f3a…'],
});
```

### 3. Policy — `ZeroPolicy`

Models never decide their own authority. Check the broker before sensitive
actions. No matching rule → deny (fail-closed).

```ts
import { ZeroPolicy } from '@baas-195/zeroai-addon';

const policy = new ZeroPolicy();
policy.addRule({ agent: 'backend', action: 'MODIFY_DATABASE', environment: 'production', decision: 'approval-required' });

const decision = policy.decide({ agent: 'backend', action: 'MODIFY_DATABASE', environment: 'production' });
// 'allow' | 'deny' | 'approval-required' — the model requests, the broker decides.
```

### 4. Gates — `ZeroGate`

Every important transition has a gate. A gate passes only on `VERIFIED`
evidence. `PARTIAL`, `FAILED`, and `UNKNOWN` all block.

```ts
import { contextGate, gatePassed } from '@baas-195/zeroai-addon';

const gate = contextGate('unit-tests', 'All unit tests green on the instance');
const state = await gate.evaluate({ testRunId: 'run-842' }); // EvidenceState
if (!gatePassed(state)) throw new Error('gate blocked: unit-tests not VERIFIED');
```

Check a gate against a live instance with `idb_gate_check` (MCP) — it
returns the evidence refs and an honest state.

## The evidence rule

This is the load-bearing rule of the entire system:

> **No evidence = UNKNOWN. Never claim success without verification.**

- A tool returning without error is not evidence. Check the returned fields.
- `provisioning` is not `ready`. `UNKNOWN` is not `passed`.
- An agent does not certify itself. The evidence does.
- When you report to a human, separate **verified facts** from **hypotheses**
  from **open questions**. Candid uncertainty beats confident weak answers.

## Worked example

An agent provisions a backend for a notes app, stores a fact, logs the event,
and checks a gate — the full loop:

```text
1. PROVISION (MCP)
   → idb_provision { name: "agent-notes" }
   ← { id: "inst_7", fqdn: "agent-notes.invisibledb.io", status: "provisioning" }

2. POLL (evidence, not hope)
   → idb_list
   ← status: "provisioning" … (repeat) … status: "ready"   ← evidence acquired

3. KEYS
   → idb_keys { instance: "inst_7" }
   ← { baseUrl, publishableKey: "pk_live_…", secretKey: "<shown once>", dartSnippet, … }

4. WRITE DATA (REST, PocketBase)
   → POST /api/collections/notes/records { title: "First note" }
   ← { id: "rec_1", … }                                    ← evidence acquired

5. MEMORY (ZeroAI)
   → memory.remember("Notes instance inst_7 serves agent-notes.invisibledb.io", "projects", { key: "notes-instance" })

6. LEDGER (ZeroAI)
   → ledger.append({ workspaceId: "agent-notes", actor: "agent:backend",
                     action: "provision_instance",
                     input: { name: "agent-notes" },
                     output: { instanceId: "inst_7", status: "ready" },
                     evidenceRefs: ["idb_list:ready", "records:rec_1"] })

7. GATE (ZeroAI)
   → idb_gate_check { instance: "inst_7", gate: "production-readiness" }
   ← { state: "UNKNOWN", evidence: [] }
   → Correct conclusion: NOT ready for production. UNKNOWN blocks.

8. REPORT (to human)
   "inst_7 is provisioned and serving (verified: /api/health 200, rec_1
    written and read back). Production-readiness gate is UNKNOWN — no
    evidence yet — so I have not marked it production-ready."
```

Note step 8: the agent reports exactly what was verified, names the open
gate, and does not upgrade UNKNOWN to success. That discipline is the
product.

## Further reading

- `packages/mcp-server/README.md` — MCP setup for Claude Code / Desktop
- `packages/cli/README.md` — CLI install and usage
- `packages/zeroai-addon/` — the deterministic OS source of truth
- `docs/14-control-plane.md`, `docs/15-reseller-tier.md` — platform context
