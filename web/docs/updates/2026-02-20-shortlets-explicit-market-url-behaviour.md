---
title: "Shortlets links now keep market params explicit"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Search
  - Shortlets
cta_href: "/shortlets"
published_at: "2026-02-20"
---

## What changed

- `/shortlets` URL updates no longer auto-add a `market` parameter during normal actions like changing dates, filters, or map bounds.
- If your current link already has `market=...`, it is preserved.
- Explicit market changes still remain in the URL.

## Why this matters

- Share links stay cleaner and easier to reason about.
- Destination remains driven by `where` and map bounds, while market stays an explicit pricing context.
