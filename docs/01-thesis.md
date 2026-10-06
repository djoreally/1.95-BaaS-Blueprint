Product Blueprint

•

Shared-Hosting Infrastructure

•

October 2026

# The $1.95 
*BaaS* Blueprint

A Coolify-style platform for the tier Coolify cannot reach: cheap cPanel shared hosting. One control plane, single-binary backends, and a repeatable recipe that turns a $2/month hosting account into auth, database, files, realtime, and deploys for a portfolio of side projects.

OrangeHost Micro as reference

5 GB NVMe

1 CPU / 1 GB RAM

PocketBase pattern

cPanel UAPI substrate

Vector / RAG ready

The wedge

Coolify starts at Docker + VPS + 2 GB RAM. Millions of developers start at $2 shared hosting. Nobody has built the PaaS for that floor.

The trick

Do not fight shared hosting. Use what it already gives you: subdomains, MySQL, cron, SSL, Node selector, and Apache - orchestrated through UAPI.

The payoff

Each new project costs minutes and megabytes, not another $20/month VPS. Perfect for a 10-20 app portfolio that compounds.

### Read this in one sitting, build it in four weeks

Phase 0 cleans the box. Phases 1-2 prove a single PocketBase project end-to-end. Phase 3 turns the manual steps into the product itself: the control plane that other low-budget developers will want to spread.

Reference substrate verified October 5, 2026: OrangeHost Web Hosting-Micro for momsoilchange.com - $1.95/mo, 5 GB NVMe (2.5 GB used), unlimited MySQL, Node 6-20, Python/Ruby/Git, jailed SSH, no PostgreSQL. Numbers elsewhere are planning estimates and are labelled as such. Host capabilities vary; run the preflight in [§17](17-build-roadmap.md) before promising a feature on a new host.

Contents

## What you are building, in order

01

What this is — and what it is not

02

Architecture at a glance

03

Phase 0: the storage and resource diet

04

Shared-hosting constraints you design around

05

Running non-root single binaries (PocketBase pattern)

06

Ports and reverse proxying through Apache

07

Process supervision without systemd

08

Multi-project pattern under 1 GB RAM

09

SSL and custom domains per project

10

Auth, data, and files

11

Vector search and AI memory (RAG)

12

Backups: Litestream to R2/B2 + restore drills

13

Push-to-deploy on shared hosting

14

The control plane — the Coolify-style product

15

The Reseller Tier — the real multi-tenant substrate

16

Limits, failure modes, and the VPS escape hatch

17

Four-week MVP roadmap

18

Reference kit and preflight checklist

### 01 What this is — and what it is not

This blueprint builds **a PaaS experience on shared-hosting primitives**. The developer connects a repo, picks a name, and gets a live URL with SSL, a backend with auth and a database, logs, env vars, and backups — the Coolify flow — without ever provisioning a VPS.

It is

- A control plane over cPanel UAPI and WHM API
- A single-binary backend pattern (PocketBase first)
- A playbook for $2–$98/month hosting tiers
- Spreadable: any cPanel host, not just OrangeHost

It is not

- Docker on shared hosting (impossible without root)
- A Supabase clone (no Postgres on this tier)
- A Coolify fork (different substrate entirely)
- Production infra for heavy traffic on day one

### The thesis in one line

Coolify sells convenience on hardware the user rents by the month. This platform sells the same convenience on hardware the user *already* rents for $2 — and that is why it spreads: the substrate is already in their pocket.

### Who it is for

Indie developers, students, bootcamp grads, and small-shop builders with three to twenty side projects, each too small to justify a $20 VPS, all of them currently scattered across free-tier dashboards that expire, throttle, or shut down. Your own portfolio — ten to twenty small apps, each with ten to twenty users — is the reference customer.
