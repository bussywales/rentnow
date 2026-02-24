---
title: "Properties filters compacted with unified category row"
audiences:
  - TENANT
  - HOST
areas:
  - Properties
  - Search
  - UX
cta_href: "/properties"
published_at: "2026-02-24"
---

## What changed

- Added a single top category row on `/properties`:
  - To rent
  - For sale
  - Short-lets
  - Off-plan
  - All homes
- Category switching now updates URL state deterministically and clears conflicting category params while preserving compatible filters.
- Removed duplicated shortlet prompts and condensed the filters stack for a tighter browsing layout on desktop and mobile.

## Why it matters

- Less empty filter chrome and cleaner first-screen focus on actual listings.
- Clearer category intent without repeating “Short-let” across multiple UI blocks.
- Existing filters (location, beds, price, amenities, etc.) continue to work as before.
