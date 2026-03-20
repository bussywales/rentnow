---
title: Payments readiness audit
date: 2026-03-20
audiences:
  - ADMIN
areas:
  - payments
  - billing
  - ops
summary: Audited Stripe and Paystack payment wiring across billing, PAYG, featured, shortlet, webhook, reconcile, and admin ops surfaces to produce a go-live readiness report and blocker list.
---

## What was reviewed

- Stripe subscription checkout, portal, webhook, and entitlement update paths
- Paystack subscription, PAYG, featured, webhook, and reconcile paths
- Shortlet payment provider routes and reconcile jobs
- Admin billing, payments, and provider settings surfaces

## What the report is for

- Establish repo truth before taking Stripe or Paystack out of test mode
- Separate genuinely wired flows from partial or fragile ones
- Give a practical must-fix / should-fix / can-wait list for go-live

## Next step

- Use the new readiness audit to close the listed blockers before enabling live provider modes.

## Rollback

- `git revert <sha>`
