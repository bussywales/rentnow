---
title: "Explore Pager V3 stability improvements"
areas: [Explore, Mobile, Performance]
audiences: [TENANT]
published_at: "2026-03-03"
---

## What changed
- Replaced the vertical Explore pager engine with a deterministic transform-based `prev/current/next` 3-slide buffer to reduce flicker on slow connections.
- Added gated vertical advance so swipes only move forward when the next listing shell is ready, preventing the "page drag" effect.
- Hardened layout reservation for Explore slides and gallery shells to keep `100svh` stability during image loading.

## Why
- Some mobile users on weaker networks saw visible blink/jank while paging vertically.
- This update keeps swipe interactions smooth and continuous while preserving existing Explore controls and analytics behavior.
