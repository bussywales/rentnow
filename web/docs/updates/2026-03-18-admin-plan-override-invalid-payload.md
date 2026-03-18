---
title: Admin plan override invalid payload fix
date: 2026-03-18
audiences:
  - ADMIN
areas:
  - billing
  - admin
  - entitlements
---

## What changed
- Fixed the admin user drawer plan override form so it uses the billing support action route instead of the unrelated plan credits route.
- Added a required reason field for plan changes in the drawer.
- Preserved support for `max_listings_override` when applying a manual plan override.

## Why
- The drawer was sending a billing override payload to `/api/admin/plans`, which only accepts plan-credit updates.
- That mismatch caused `Invalid payload.` when admins tried to save a plan override.

## Rollback
- Revert commit for this fix.
