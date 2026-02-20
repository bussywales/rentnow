---
title: "Shortlet calendar availability now preloads progressively"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Shortlets
  - Performance
cta_href: "/properties"
published_at: "2026-02-20"
---

## What changed

- Refactored shortlet availability prefetching into a deterministic scheduler with request dedupe.
- Prioritised immediate loading for the current and next month, then deferred wider month prefetch after interaction/idle.
- Kept date disabling and booking validation rules unchanged while reducing unnecessary availability calls.
