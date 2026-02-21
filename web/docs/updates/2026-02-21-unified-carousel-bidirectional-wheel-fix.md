---
title: "Fixed bidirectional Magic Mouse swipe in unified property carousels"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Properties
  - Shortlets
  - Search
cta_href: "/properties"
published_at: "2026-02-21"
---

## What changed

- Updated the shared carousel wheel/gesture handler so horizontal swipe works in both directions on desktop devices (including Magic Mouse and trackpad).
- Added a non-passive wheel listener on the carousel viewport to ensure horizontal gestures can reliably prevent default browser scroll when appropriate.
- Kept vertical page scrolling behavior intact when horizontal intent is not detected.

## Why this matters

- `/properties/[id]` detail gallery now matches `/shortlets` carousel behavior for left/right swipes.
- Users can consistently move to next and previous images with natural desktop gestures.
