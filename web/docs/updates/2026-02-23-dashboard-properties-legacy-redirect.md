---
title: "Legacy dashboard property edit routes now redirect to host workspace editor"
audiences:
  - HOST
  - AGENT
  - ADMIN
areas:
  - WORKSPACE
  - ROUTING
cta_href: "/host/properties"
published_at: "2026-02-23"
---

## What changed

- Added a canonical host edit route at `/host/properties/[id]/edit`.
- Redirected legacy `/dashboard/properties/[id]` requests to the host edit route while preserving query params.
- Kept existing auth and role behaviour:
  - unauthenticated users still go to login
  - tenant users still redirect to tenant home

## Why it matters

- Prevents legacy edit links from trapping users in old route flows.
- Keeps host and agent property editing inside the workspace-native URL structure.
