# DRAFT — requires attorney review before use. Not legal advice.

# InvisibleDB Hosted Service — Terms of Service

**Last updated:** [DATE]  
**Operator:** [LEGAL ENTITY NAME], [ADDRESS] ("we", "us")

These terms form the subscription agreement between you ("customer") and us for
the InvisibleDB hosted backend service (the "Service").

## 1. The Service

We provision and operate an isolated PocketBase-backed database instance for
you, reachable at your assigned subdomain, with auth, file storage, and vector
search through our SDKs and REST API. You give us an email address; we handle
the infrastructure.

## 2. Subscription and fees

- **Price:** $6.99 USD per seat per month, billed monthly in advance.
- **Intro offer:** your first month is $1.00, then $6.99/month until cancelled.
- **Billing:** via Stripe. You authorize recurring charges to your payment method.
- **Cancel anytime** from your dashboard; service runs to the end of the paid
  period. No refunds for partial months.

## 3. Your data is yours

Your database file — every record, file, and embedding your application
stores — belongs to you. We claim no ownership over customer data. On
cancellation or termination you may export your full SQLite database file at
any time during a 30-day grace period, after which the instance and its data
are deleted.

## 4. Acceptable use

You may not use the Service to: break the law; store or distribute malware;
send spam; mine cryptocurrency; attack other systems; resell the Service as a
competing backend platform; or exceed reasonable resource limits for your plan
(currently: 256 MB RAM, 10 GB storage per instance — we publish changes
30 days in advance).

We may suspend instances engaged in abuse, with notice when practical.

## 5. API keys

Your API key is a secret. Keep it in an environment variable, never in
client-side code shipped to browsers you don't control, and never in a public
repo. You are responsible for calls made with your key until you rotate it.
Rotate anytime from the dashboard.

## 6. Uptime and support

We target 99.9% monthly availability but offer no SLA credits at this time.
Support is via [SUPPORT EMAIL]; we aim to respond within one business day.

## 7. Backups

We take nightly backups of your database file and retain 7 daily + 4 weekly
copies. Backups are for disaster recovery, not a versioned archive — keep your
own exports for anything critical.

## 8. Termination

Either side may terminate with 30 days' notice. We may terminate immediately
for non-payment (after 14 days' grace) or acceptable-use violations. Section 3
(data export grace period) survives termination.

## 9. Liability

The Service is provided "as is". To the maximum extent permitted by law, our
aggregate liability is limited to the fees you paid in the 12 months before the
claim. We are not liable for indirect, incidental, or consequential damages,
including data loss beyond our backup obligations in Section 7.

## 10. Changes

We may update these terms with 30 days' notice by email. Continued use after
the notice period is acceptance.

---

*BYOH (self-hosted) customers are covered by the BYOH License, not these terms.*
