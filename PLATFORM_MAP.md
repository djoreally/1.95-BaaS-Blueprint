# InvisibleDB — Full Platform Map

**Status:** 2026-10-08 · Living doc. Mark each box `[built]`, `[stubbed]`, or `[missing]` honestly.

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
│  CONTROL PLANE  (Next.js, Vercel → www.invisibledb.app)        │
│                                                              │
│  /signup ──→ Stripe Checkout ($6.99, $1 first mo)             │
│       │         │ webhook → Subscription + ProvisionRequest   │
│       │         ▼                                            │
│       │   /api/vps/requests ← VPS poller (2 min, secret)     │
│       │                                                      │
│  /admin ──→ super-admin dashboard (subs, queue, users) [built]│
│  /projects → "Your Databases" dashboard [built] — reads      │
│    ProvisionRequest rows, shows endpoint + SDK snippet       │
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
| VPS | InterServer 66.23.224.55 | `[built]` live, serving | $3/mo price-locked, Ubuntu 26.04 |
| Caddy edge (auto-TLS) | `deploy/vps` | `[built]` live, certs issuing | demo.invisibledb.app verified |
| Per-customer PocketBase | `deploy/vps/pocketbase` | `[built]` live | demo instance verified end-to-end |
| Auth gateway | `deploy/vps/gateway` | `[built]` live | key→token swap verified, 200/401 correct |
| bin/provision|deprovision|backup|poll | `deploy/vps/bin` | `[built]` live | poller every 2 min |
| Control plane (marketing/docs) | Vercel | `[built]` live | |
| Super-admin auth + dashboard | `app/admin` | `[built]` tsc clean | seed before first login |
| Stripe webhook → queue | `app/api/billing/webhook` | `[built]` tsc clean | product `prod_VOxrNECaDbKlsF`, price `price_1UO9wRADolYVlmkJHgCt9lcR` ($6.99/mo), coupon `FIRST_MONTH_1` ($1 first month) — live under Book Your Oil Change |
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

## What "1.0 launched" still needs

1. **Stranger test** — the golden path from a brand-new account with zero manual
   intervention: create account → pay $1 → entitlement activates → instance
   provisions → endpoint READY → API key works → SDK CRUD → files → vectors →
   realtime → cancel/deprovision behaves. This is the launch gate.
2. sqlite-vec build verified on the box.
3. SDKs live-verified against a real customer container (not just demo).
4. Webhook secret in Vercel env (`STRIPE_WEBHOOK_SECRET`) + live webhook test.
5. Attorney sign-off on legal drafts.
6. Status page + 70% disk alert.
7. AppSumo partner submission (blocked: Tyreese's product URL + approval).

Done since 2026-10-07: box live + deploy run · Stripe product/price/coupon
created · `/projects` rewritten as "Your Databases" · login + billing + domain
session bugs fixed · `ProvisionRequest` migration added.
