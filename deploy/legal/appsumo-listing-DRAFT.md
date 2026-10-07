# InvisibleDB — AppSumo listing draft (BYOH self-hosted tier)
<!-- Paste into partners.appsumo.com listing flow. Adjust pricing after partner review. -->

## Product name
InvisibleDB — The Invisible Backend for Indie Devs

## Tagline (60 chars)
Auth, database, files & vectors in one snippet. Your server, your data.

## Short description
Stop over-complicating your backend. InvisibleDB gives you everything Firebase
does — auth, realtime database, file storage, and native vector embeddings —
through one SDK and one snippet. The difference: it runs on YOUR server, and
the database file is yours. No per-read billing surprises. No lock-in.

## Long description

**The problem:** you want to build app features, not babysit infrastructure —
but Firebase bills you per read and locks your data in their cloud.

**What InvisibleDB is:** a complete backend you self-host in minutes. One
Docker command and you have:

- **Realtime SQLite database** — collections, queries, subscriptions. The `.db`
  file lives on your disk. Copy it, back it up, move hosts whenever you want.
- **Auth built in** — email/password, OAuth, per-user data scoping.
- **File storage** — uploads with zero config.
- **Native vector search** — `vec0` tables for embeddings, no sidecar service.
- **One snippet** — `new InvisibleDB({ baseUrl, apiKey })` and you're querying.

**Who it's for:** indie hackers, agency devs, and AI-coding-tool users who
want a backend that doesn't phone home with a meter running.

**What you get with this deal:** the commercial BYOH license — one production
deployment, unlimited dev/staging copies, 12 months of updates, no AGPL
network-service obligations. Your modifications stay yours.

## Pricing tiers (suggested — confirm with AppSumo partner manager)
- Tier 1 ($49): 1 production deployment
- Tier 2 ($99): 3 production deployments
- Tier 3 ($199): 10 production deployments + priority support

## FAQ (pre-answered for the listing)
**Do I need my own server?** Yes — that's the point. Any $3–6/mo VPS runs it
(one Docker command). Your data never touches our infrastructure.
**How is this different from PocketBase?** It's PocketBase, hardened for
production: per-customer isolation pattern, backup tooling, vector search
built in, and commercial licensing so agencies can ship client work.
**How is this different from NoCodeBackend?** Data freedom. Your database is a
file you own, not rows in someone else's system. Vectors are native, not an
add-on.
**What happens after 12 months?** The software keeps working forever. Renew
only if you want continued updates.

## Review-risk notes (internal — do not publish)
- Setup friction is the #1 rating killer on AppSumo. The one-command Docker
  install MUST work first try — test on a fresh VPS before submitting.
- The license phone-home check (in BYOH license draft) will get questioned in
  reviews. Decide before launch: keep it or drop it for the AppSumo tier.
- Video: 60–90s screen recording of install → first query. No stock footage.
