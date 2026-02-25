---
title: "Shortlets mobile sticky controls now collapse on scroll for a cleaner search flow"
audiences:
  - TENANT
areas:
  - Shortlets
  - Search
  - Mobile
summary: "The mobile shortlets sticky bar now collapses to compact chips while scrolling down, expands on upward interaction, and stays stable when filters/date drawers are open."
published_at: "2026-02-25"
---

## What changed

- Added mobile-only collapse-on-scroll behaviour for the `/shortlets` sticky controls.
- Added a compact collapsed row with quick chips for Where, Dates, and Guests plus a Filters action.
- Kept existing search/filter/map behaviour unchanged while making the sticky UI less intrusive.
- Added safeguards so the sticky bar does not fight open overlays (filters/date/map) and expands when users focus sticky chips.

## Why this helps

- Mobile browsing feels more app-like and less cluttered while keeping critical controls one tap away.
- The sticky controls now occupy less space during deep scrolling, improving results visibility.
