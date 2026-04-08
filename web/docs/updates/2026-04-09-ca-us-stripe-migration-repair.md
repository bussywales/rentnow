---
title: "CA/US Stripe migration repair"
audiences:
  - ADMIN
areas:
  - Billing
  - Database
cta_href: "/admin/billing"
published_at: "2026-04-09"
---

## What changed

- Repaired the historical `20260406173000_ca_us_stripe_market_completion.sql` migration so seeded price-book ids are explicitly cast to `uuid`.
- Added a migration contract test to prevent the file from drifting back into a state that fails on fresh database setup.

## Why it matters

- The linked remote database already reflects the intended CA/US Stripe rows, but the committed historical migration on `main` was still vulnerable to failing on clean environments.
- This was resolved as a historical migration repair, not a new forward migration, because a later migration cannot rescue an earlier migration that fails before it runs.

## Resolution

- Final resolution: repair the historical migration and keep it committed clean.
- No new migration was created because the delta was required for the original seed insert itself, not as a later schema or data change.
