---
title: "Shortlets image loading now prioritises above-the-fold cards"
audiences:
  - TENANT
  - HOST
  - AGENT
areas:
  - Shortlets
  - Search
  - Performance
cta_href: "/shortlets"
published_at: "2026-02-20"
---

## What changed

- Added an explicit carousel loading profile so only first visible card images are eagerly fetched.
- Kept all card and map interactions unchanged while switching non-priority card images to lazy loading.
- Improved image delivery stability without altering search behaviour, filters, or booking actions.
