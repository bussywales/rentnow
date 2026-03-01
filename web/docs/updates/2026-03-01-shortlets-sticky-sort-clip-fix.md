---
title: "Shortlets sort pill no longer clips on mobile sticky bar"
summary: "The shortlets sticky sort control now keeps its label readable with truncation-safe sizing while preserving horizontal chip scrolling."
areas: [Tenant, Shortlets, UX]
audiences: [TENANT]
published_at: "2026-03-01"
---

## What changed
- Increased sticky sort pill min/max width and kept it non-shrinking in both sticky states.
- Added truncation-safe text handling so long sort labels stay readable without visual clipping.
- Kept horizontal rail scrolling and edge fade behavior unchanged.

## Why
- Some mobile layouts clipped the sort pill text in expanded sticky state, reducing clarity and tap confidence.
