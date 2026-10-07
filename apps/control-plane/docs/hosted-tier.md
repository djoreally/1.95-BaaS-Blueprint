# Managed Hosted Tier

The paid InvisibleDB tier launches on the platform owner's existing cPanel account before graduating to reseller/WHM isolation.

## Modes

- `HOSTED` — InvisibleDB supplies the hosting. Customers never enter cPanel credentials.
- `BYOH` — customers connect their own cPanel account and keep the existing provisioning flow.

## Hosted request path

1. Customer enters through `/signup` (HOSTED by default).
2. The app stores `baas_hosting_mode=HOSTED` in the session cookie.
3. `/projects/new` resolves the platform hosting connection instead of redirecting to `/connect`.
4. The server chooses `HOSTED_BASE_DOMAIN` (or the platform connection's main domain as a temporary fallback).
5. `POST /api/projects` ignores any customer-supplied hosted domain and provisions only under the managed domain.
6. The existing UAPI provisioner creates the subdomain, isolated database/user, SSL, cron/watchdog configuration and proxy rules.

## Production requirements before public paid launch

- Real authentication and per-user/project ownership.
- Stripe subscription entitlement (`$1` first month, then `$6.99/mo`).
- Stripe webhook state as the billing authority.
- Hosted resource quotas and abuse controls on the shared cPanel substrate.
- Customer API-key lifecycle and encrypted secret delivery.
- Suspension/reactivation behavior for billing failures.
- Export + grace-period policy before destructive cancellation cleanup.
- Capacity telemetry (CPU, memory, disk, database size, process count).

## Graduation path

The customer-facing `HOSTED` contract does not change when the platform moves to reseller hosting. `getPlatformConnection()` is the abstraction boundary: today it resolves the existing shared cPanel account; later it can resolve/provision isolated WHM-backed tenant accounts without changing signup or project-creation UX.
