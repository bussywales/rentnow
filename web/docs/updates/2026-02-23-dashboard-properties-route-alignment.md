---
title: "Legacy dashboard property routes now align to host listings surfaces"
audiences:
  - HOST
  - AGENT
  - ADMIN
areas:
  - WORKSPACE
  - ROUTING
cta_href: "/host/listings"
published_at: "2026-02-23"
---

## What changed

- Updated `/dashboard/properties` to redirect to `/host/listings` (query params preserved).
- Updated `/dashboard/properties/[id]` to redirect to `/host/properties/[id]/availability` with query params preserved.
- Kept existing auth and role guards (login redirect for unauthenticated users, tenant redirect to tenant home).

## Why it matters

- Removes dead-end legacy dashboard paths while keeping deep links safe.
- Keeps hosts and agents on workspace-native routes for listing operations.
