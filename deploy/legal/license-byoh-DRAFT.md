# DRAFT — requires attorney review before use. Not legal advice.

# InvisibleDB BYOH License (commercial self-hosted)

For customers who buy the self-hosted edition (e.g. the AppSumo lifetime tier)
and run InvisibleDB on their own infrastructure.

## Relationship to the open-source licenses

This repo's code carries split open-source licenses (Apache-2.0 for
`packages/adapter-cpanel` and `packages/supervisor`; AGPL-3.0 for
`apps/control-plane`). This commercial BYOH license is a **separate,
paid grant** that replaces the copyleft obligations for the licensed version:

- Under AGPL-3.0 §13, running a modified control plane as a network service
  would require sharing your modifications. **This license removes that
  requirement** for your deployment — your modifications stay yours.
- You may not redistribute, resell, or sublicense the software itself.

If you prefer the open-source terms instead, the AGPL-3.0 text in
`apps/control-plane/LICENSE` remains available — pick one license, not both,
per deployment.

## Grant

One license = one production deployment (unlimited dev/staging copies).
You may: install, run, and modify the software on infrastructure you control;
use it to power applications for yourself or your clients.

You may not: redistribute the software; offer it as a competing hosted
backend service; remove license key checks.

## License key

BYOH copies phone home once at install (and weekly thereafter) to validate the
key. No application data ever leaves your server — the check transmits only
the key and version. If validation lapses, the software keeps running; admin
features pause until revalidated.

## Support and updates

12 months of updates and email support included. Renewal: [PRICE]/year,
optional — the software keeps working if you don't renew, you just stop
getting updates.

## Warranty and liability

Provided "as is". Aggregate liability capped at the license fee paid.
No liability for indirect or consequential damages.

---

*Hosted-service customers are covered by the Hosted Terms of Service, not
this license.*
