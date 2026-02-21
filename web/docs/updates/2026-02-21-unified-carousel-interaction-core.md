---
title: "Unified carousel interaction core across shortlets and property galleries"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Properties
  - Shortlets
  - Search
cta_href: "/shortlets"
published_at: "2026-02-21"
---

## What changed

- Moved carousel gesture handling into a single shared interaction core used by shortlet cards, property cards, and property detail galleries.
- Improved bidirectional wheel accumulation so reverse-direction swipes are handled consistently instead of getting stuck behind same-direction momentum.
- Kept swipe-to-click suppression and horizontal-intent detection aligned across all carousel surfaces.

## Why this matters

- Gallery swipe behaviour now feels consistent between `/shortlets`, `/properties`, and `/properties/[id]`.
- Desktop trackpad and Magic Mouse gestures can reliably move both next and previous images without accidental navigation.
