---
title: Tenant saved-search entitlement audit and expiry alignment
date: 2026-03-18
audiences:
  - ADMIN
  - TENANT
areas:
  - billing
  - plans
  - entitlements
summary: Audited tenant saved-search entitlement enforcement and aligned expired plan override displays with the effective plan so UI and saved-search limits now agree.
---

## What was found

Expired `tenant_pro` overrides were already falling back to Free for saved-search enforcement, but several UI surfaces still showed the raw stored tier as if it were current.

## What changed

- Added shared effective-plan helpers for expired manual overrides.
- Updated tenant billing and admin plan displays to show current effective access instead of the raw expired tier.
- Kept expired state visible so admins can still see that an override previously existed.

## Rollback

- `git revert <sha>`
