# Hosted paid-tier launch

This branch adds the first production-facing split between managed hosting and BYOH.

- Public `/signup` defaults to `HOSTED`.
- `/hosted` is an explicit managed-hosting entry point.
- `/byoh` routes to the existing customer-hosting path.
- Hosted users skip `/connect` entirely.
- Hosted project creation uses the platform owner's stored cPanel connection.
- The server chooses `HOSTED_BASE_DOMAIN` and ignores customer-supplied domains for managed projects.
- The low-level UAPI project provisioner remains unchanged.

Still required before charging the public: real auth, Stripe entitlement/webhooks, shared-host resource quotas, customer secret lifecycle, suspension/reactivation, and capacity telemetry.
