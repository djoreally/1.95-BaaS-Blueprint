Product Blueprint

•

VPS/Docker Infrastructure

•

October 2026

# InvisibleDB: the invisible backend

Auth, database, files, vector embeddings, and one snippet to wire them all — for indie devs who fear the Firebase bill. You give us an email address; we provision an isolated, secure SQLite database in the cloud instantly. Paste one snippet, hold your API key in an environment variable, and go back to building your actual app features.

InterServer VPS as reference

vps3695717.trouble-free.net (66.23.224.55)

$3/mo price-locked, Ubuntu 24.04, Docker

PocketBase per customer

Caddy edge + auth gateway

Vector-ready (sqlite-vec)

The wedge

Coolify starts at "bring your own server and manage it." Firebase starts free and bills you when you succeed. Millions of indie devs start with one app and one fear: the bill. Nobody sells them *infrastructure they never have to think about* at a price below a coffee.

The trick

A $3/mo VPS plus Docker plus one control plane: the customer never sees the box. Per-customer PocketBase containers with isolated SQLite volumes, Caddy auto-TLS on `*.invisibledb.app`, an auth gateway that turns one API key into full backend access, and a Stripe-webhook → VPS-poller provisioning loop that needs zero human touch. The database file is theirs — no lock-in.

The payoff

$6.99/seat at ~9x margin on ≈$0.76/seat — reseller pricing that undercuts PocketHost's $9.99 while staying real money, not "free tier that bills you later." Each new customer costs one container and one SQLite volume, provisioned in about two minutes.

### Read this in one sitting, build it in four weeks

Phase 0 keeps the $3 box healthy. Phases 1-2 prove a single customer container end-to-end. Phase 3 turns the manual provisioning steps into the product itself: the control plane at www.invisibledb.app that other indie developers will want to buy.

Reference substrate verified October 7, 2026: InterServer KVM VPS Slice (Ubuntu, vps3695717.trouble-free.net, 66.23.224.55) — $3/mo price-locked; Docker + Caddy + auth gateway + PocketBase v0.36.5 container verified live. Numbers elsewhere are planning estimates and are labelled as such. Host capabilities vary; run the preflight in [§17](17-build-roadmap.md) before promising a feature on a new substrate.

Contents

## What you are building, in order

01

What this is — and what it is not

02

Architecture at a glance

03

Phase 0: VPS resource hygiene

04

What the VPS gives you — and the discipline it still needs

05

Running one container per customer (PocketBase pattern)

06

Caddy as your ingress

07

Process supervision without systemd babysitting

08

Multi-project pattern under a $3 box

09

SSL and custom domains per project

10

Auth, data, and files

11

Vector search and AI memory (RAG)

12

Backups: SQLite snapshots + restore drills

13

Push-to-deploy on the VPS

14

The control plane — the Coolify-style product

15

The Reseller Tier — isolated accounts per customer

16

Limits, failure modes, and the second-box escape hatch

17

Four-week MVP roadmap

18

Reference kit and preflight checklist

### 01 What this is — and what it is not

This blueprint builds **a backend the customer never thinks about**. The developer signs up, gets an API key, and pastes one snippet — auth, database, files, realtime, and vector search just work at `<slug>.invisibledb.app`, over TLS, from day one. They never touch the VPS, never configure TLS, never see a container.

It is

- A control plane (Next.js on Vercel) that provisions backends on a $3/mo Docker VPS
- One PocketBase container per customer, each with its own isolated SQLite volume
- A priced product: $6.99/mo per seat, first month $1 — ~9x margin at ≈$0.76/seat
- Spreadable: the same recipe works on any Docker VPS, not just InterServer

It is not

- A Supabase clone (no Postgres — SQLite is the whole point, and the customer owns the file)
- A Coolify fork (customers get an API key, not a server dashboard)
- A bring-your-own-Firebase story (no surprise billing curve — flat $6.99)
- Production infra for heavy traffic on one $3 box on day one (see [§16](16-resource-budgets-limits.md))

### The thesis in one line

Firebase sells the backend and rents you the anxiety; this platform sells the backend and deletes the anxiety — $3/mo of VPS plus Docker plus one control plane becomes $6.99/seat of invisible backend, with a SQLite file the customer actually owns.

### Who it is for

Indie developers, students, bootcamp grads, and small-shop builders with three to twenty side projects, each too small to justify per-project infrastructure, all of them currently choosing between free tiers that expire, throttle, or shut down — and Firebase bills that spike when something works. Your own portfolio — ten to twenty small apps, each with ten to twenty users — is the reference customer. The Dart SDK makes it first-class for mobile devs too, but it is not Flutter-only: JS SDK, REST, `idb` CLI, and an MCP server cover everything else.
