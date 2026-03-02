---
title: "Explore performance upgrades for weak mobile data (v0.4)"
summary: "Improved Explore performance on weak mobile data with progressive image loading."
areas: [Tenant, Explore, UX]
audiences: [TENANT]
published_at: "2026-03-02"
---

## What changed
- Added low-bandwidth detection for Explore using `saveData` and connection `effectiveType` hints.
- Reduced media pressure on weak networks by keeping adjacent Explore slides to hero-image-only loading.
- Added capped, windowed image loading so only a small number of pending carousel images mount at once.
- Added stable loading placeholders and a subtle loading cue while active media resolves.

## Why
- On weaker mobile data, loading too many images at once can delay interaction and make swipe-heavy browsing feel sticky.
- This update prioritizes smooth vertical and horizontal swiping first, then progressively fills in richer media.
