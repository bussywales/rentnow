---
title: "Host listings view-all grid now uses a deterministic editorial mosaic"
audiences:
  - HOST
  - AGENT
areas:
  - Host
  - Listings
cta_href: "/host?view=all"
published_at: "2026-02-23"
---

## What changed

- The host listings feed grid now uses a deterministic editorial mosaic rhythm instead of row-span masonry.
- Tile media now follows stable aspect rules:
  - default `4:5`
  - every 5th tile `1:1`
  - every 7th tile `16:9`
- Every media tile is capped at `max-h-[60vh]` to prevent overly tall cards.
- Missing-image cards now render a branded in-tile placeholder (`No photo yet`) instead of a plain block.
- Added subtle hover/focus polish for premium scanability without changing listing actions or logic.

## Why

- Prevents perspective-breaking tall cards in `/host?view=all`.
- Keeps the grid visually rhythmic and easier to scan across device sizes.
