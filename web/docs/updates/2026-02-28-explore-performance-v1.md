---
title: "Explore feels smoother on mobile (performance pass v1)"
audiences:
  - TENANT
areas:
  - Tenant
  - Explore
  - UX
summary: "Explore now reduces avoidable re-renders, lazy-mounts heavy details content, and improves iOS swipe/scroll stability for smoother browsing."
published_at: "2026-02-28"
---

## What changed

- Reduced Explore pager re-renders by stabilising callback props and memoising slide/gallery components.
- Added lightweight dev-only performance counters for pager/slide render tracing behind a debug flag.
- Improved image presentation smoothness with async decoding in the shared carousel.
- Lazy-mounted heavy Explore details sheet body content so closed sheets do not render amenities/similar blocks.
- Improved iOS interaction stability with safer touch-action settings and imperative vertical-scroll lock handling during horizontal gestures.

## Why this helps

- Smoother vertical paging on older devices.
- Less work per swipe and fewer unnecessary child renders.
- Faster-feeling details flow without changing product behaviour.
