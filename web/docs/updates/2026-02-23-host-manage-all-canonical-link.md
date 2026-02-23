---
title: "Host listings feed Manage all now targets canonical listings page"
audiences:
  - HOST
  - AGENT
areas:
  - HOST
  - WORKSPACE
cta_href: "/host/listings"
published_at: "2026-02-23"
---

## What changed

- Updated host listings feed “Manage all” links to point to `/host/listings`.
- Added regression test coverage so these links do not drift back to legacy dashboard paths.

## Why it matters

- Keeps hosts on the canonical workspace route from the listings feed.
- Avoids legacy route confusion and reduces dead-end navigation.
