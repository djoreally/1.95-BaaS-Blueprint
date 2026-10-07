# InvisibleDB — Full Platform Map

**Status:** 2026-10-07 · Living doc. Mark each box `[built]`, `[stubbed]`, or `[missing]` honestly.

## The one-liner

You give us an email address, we provision an isolated, secure SQLite database
in the cloud for you instantly. Auth, files, and vector embeddings native.
One snippet, API key in an env var, back to building.

## Architecture

```
                          ┌─────────────────────────────┐
                          │        CUSTOMER APP         │
                          │  new InvisibleDB({          │
                          │    baseUrl, apiKey })       │
                          └──────────────┬──────────────┘
                                         │ HTTPS  Authorization: Bearer <key>
                                         ▼
┌──────────────┐   ┌──────────────────────────────────────────────┐
│  INTERSERVER │   │  VPS  vps3695717 (66.23.224.55)  $3/mo        │
│  KVM 1 slice │   │                                              │
└──────────────┘   │  ┌─────────┐  ┌──────────┐  ┌──────────────┐  │
                   │  │  CADDY  │→ │ GATEWAY  │→ │ idb-<slug>   │  │
                   │  │ autoTLS │  │ key check│  │ PocketBase   │  │
                   │  └─────────┘  │ token    │  │ + SQLite vol │  │
                   │               │ swap     │  └──────────────┘  │
                   │               └──────────┘   × N customers   │
                   │  cron: backup (2am) · poll-provision (2min)  │
                   └──────────────────────────────────────────────┘
                                         ▲ provisions via queue
                                         │
┌──────────────────────────────────────────────────────────────┐
│  CONTROL PLANE  (Next.js, Vercel → baas.invisibledb.app)      │
│                                                              │
│  /signup ──→ Stripe Checkout ($6.99, $1 first mo)             │
│       │         │ webhook → Subscription + ProvisionRequest   │
│       │         ▼                                            │
│       │   /api/vps/requests ← VPS poller (2 min, secret)     │
│       │                                                      │
│  /admin ──→ super-admin dashboard (subs, queue, users) [built]│
│  /projects → BYOH cPanel provisioning (original path)         │
│  /docs /pricing /tools /agents                               │
└──────────────────────────────────────────────────────────────┘

  ┌─────────────┐   ┌──────────┐   ┌───────────┐
  │ MCP server  │   │ idb CLI  │   │ SDKs      │
  │ AI agents   │   │ terminal │   │ JS + Dart │
  └─────────────┘   └──────────┘   └───────────┘
```

## Component inventory

| Piece | Where | State | Notes |
|---|---|---|---|
| VPS | InterServer 66.23.224.55 | `[built]` ordered, `[stubbed]` setup pending | $3/mo price-locked |
| Caddy edge (auto-TLS) | `deploy/vps` | `[built]` compose, untested live | |
| Per-customer PocketBase | `deploy/vps/pocketbase` | `[built]` Dockerfile, untested live | `:vec` variant needs box build |
| Auth gateway | `deploy/vps/gateway` | `[built]` smoke-tested w/ mocks | key→token swap verified |
| bin/provision|deprovision|backup|poll | `deploy/vps/bin` | `[built]` syntax-checked | |
| Control plane (marketing/docs) | Vercel | `[built]` live | |
| Super-admin auth + dashboard | `app/admin` | `[built]` tsc clean | seed before first login |
| Stripe webhook → queue | `app/api/billing/webhook` | `[built]` tsc clean | needs Stripe keys + product |
| VPS poller API | `app/api/vps/requests` | `[built]` tsc clean | needs VPS_API_SECRET both ends |
| MCP server | `packages/mcp-server` | `[built]` tests green | single-key client (post-revert) |
| `idb` CLI | `packages/cli` | `[built]` | |
| JS SDK (`packages/sdk-js`) | npm | `[built]` CRUD/files/vectors/SSE, 6/6 tests, tsc clean | live-verify vs box pending |
| Dart SDK (`packages/sdk-dart`) | pub.dev | `[built]` same surface (no realtime) | needs `dart test` on a Dart machine |
| sqlite-vec | `Dockerfile.vec` | `[stubbed]` written, needs box build | |
| Legal (ToS/privacy/DPA/BYOH) | `deploy/legal` | `[stubbed]` drafts, attorney review needed | |
| Status page | — | `[missing]` | Phase 4 |
| AppSumo BYOH listing | draft written | `[stubbed]` needs partner submission | |

## Money flow

Stripe Checkout ($6.99/mo, $1 first month coupon) → `checkout.session.completed`
→ Subscription row + ProvisionRequest → VPS poller (2 min) → `bin/provision`
→ customer emailed snippet + key. Cancel → `customer.subscription.deleted` →
deprovision queue → container + volume dropped (backup retained). Failed
payment → `past_due`, no auto-kill (14-day grace per ToS).

## Trust boundaries

- Customer key never reaches PocketBase (gateway swaps to superuser token).
- Keys at rest: 0600 files on the VPS; never in git, logs, or the control plane DB.
- Control plane ↔ VPS: shared `VPS_API_SECRET`, poller-initiated (VPS pulls).
- Box SSH: key-only, UFW (22/80/443), fail2ban, auto-updates (runbook §1).

## What "enterprise green" still needs

1. Box live + deploy run (blocked: InterServer setup).
2. Stranger test: signup → pay → provisioned → first query < 10 min.
3. sqlite-vec build verified on the box.
4. SDKs live-verified against a real customer container.
5. Stripe product + webhook wired (blocked: Tyreese's dashboard).
6. Attorney sign-off on legal drafts.
7. Status page + 70% disk alert.
8. AppSumo partner submission (blocked: Tyreese's product URL + approval).
