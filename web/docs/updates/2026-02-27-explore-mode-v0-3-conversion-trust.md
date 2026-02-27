---
title: "Explore makes it easier to act (next steps + viewing request)"
audiences:
  - TENANT
areas:
  - Tenant
  - Discovery
  - UX
  - Conversion
  - Trust
summary: "Explore now adds a What happens next micro-sheet, a prefilled editable viewing request message, market-consistent feed/badges, and local-first action analytics for swipe and CTA behaviour."
published_at: "2026-02-27"
---

## What changed

- Added a `What happens next` micro-sheet before the Explore primary CTA proceeds.
- Added an editable prefilled `Request viewing` message with quick availability chips (`Weekdays`, `Weekends`, `Evenings`).
- Added a fast-path `Send request` flow from Explore details that reuses existing viewing request infrastructure.
- Improved market trust integrity in Explore by filtering the feed to current market when possible and binding trust-market labels to each listing market.
- Added local-first Explore analytics events for:
  - Explore entry
  - swipe depth
  - details opens
  - CTA taps
  - save/share actions
  - not-interested actions

## Why this helps

- Reduces uncertainty right before high-intent actions.
- Lowers friction for viewing requests without introducing a new backend path.
- Prevents market-label mismatches that reduce trust.
- Gives product-level conversion signals without personal profiling or demographic inference.
