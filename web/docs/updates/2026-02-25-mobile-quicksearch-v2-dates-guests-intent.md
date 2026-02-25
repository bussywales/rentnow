---
title: "Mobile quick search v2: dates, guests & intent"
audiences:
  - TENANT
  - HOST
areas:
  - Tenant
  - Discovery
  - Search
  - Home
summary: "Upgraded mobile quick search with intent chips, weekend date picks, and guest controls while keeping URL-driven navigation."
published_at: "2026-02-25"
---

## What changed

- Added intent chips to mobile quick search (`Shortlet`, `Rent`, `Buy`) for faster route selection.
- Added date quick picks (`This weekend`, `Next weekend`, `Flexible`) using a lightweight local date helper.
- Added a guest stepper for shortlet searches.
- Kept routing URL-driven and backward compatible:
  - Shortlet searches now include `checkIn`, `checkOut`, and `guests` when selected.
  - Property searches continue using existing category/intent/city params.
- Added market-aware local default intent memory (per market in localStorage) without adding new market URL params.
