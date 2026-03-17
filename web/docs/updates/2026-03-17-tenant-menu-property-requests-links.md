---
title: Tenant menu links for Property Requests
date: 2026-03-17
audiences:
  - TENANT
  - HOST
  - ADMIN
areas:
  - navigation
  - requests
  - tenant
summary: Added tenant-only menu links for `Make a Request` and `My Requests` so repeat Property Request actions are easier to find from the shared account menu.
---

## What changed

- Added `Make a Request` to the tenant menu, linking to `/requests/new`.
- Added `My Requests` to the tenant menu, linking to `/requests/my`.
- Kept the change scoped to the tenant menu only, without changing the broader desktop top navigation.

## Which links were added

- `Make a Request`
- `My Requests`

These links are tenant-only and do not appear for landlord, agent, or admin roles.

## Rollback

- Revert the shipping commit.
