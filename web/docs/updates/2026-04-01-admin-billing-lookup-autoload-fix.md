---
title: "Admin billing lookup autoload fix"
audiences:
  - ADMIN
areas:
  - Billing
  - Support
cta_href: "/admin/billing"
published_at: "2026-04-01"
---

# Admin Billing Lookup Autoload Fix

## What changed

- Hardened `/admin/billing` query-param lookup so empty values like `profileId=` are treated as absent instead of poisoning email-based lookup.
- Cleaned billing recovery deep-links so they only include query params that actually exist.
- Added an explicit lookup failure state when a billing lookup was attempted but no snapshot could be loaded.

## Who it affects

- Tenant: no product-lane change in this batch.
- Host/Agent: no product-lane change in this batch.
- Admin: billing recovery and manual lookup now fail visibly instead of falling back to an ambiguous blank shell.

## Where to find it

- `/admin/billing`

