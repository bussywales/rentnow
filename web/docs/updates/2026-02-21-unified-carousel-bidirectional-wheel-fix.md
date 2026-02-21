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
- Improved wheel gesture reliability on detail galleries by accumulating fine-grained trackpad deltas and allowing instant reverse-direction swipes without getting blocked by same-direction cooldown.
- Unified the carousel interaction policy in one shared module so `/shortlets` cards, `/properties` cards, and `/properties/[id]` detail gallery all use the same gesture thresholds and drag-click suppression rules.
- Kept vertical page scrolling behavior intact when horizontal intent is not detected.

## Why this matters

- `/properties/[id]` detail gallery now matches `/shortlets` carousel behavior for left/right swipes.
- Users can consistently move to next and previous images with natural desktop gestures.
