---
title: "Mobile performance polish (reduced layout shift)"
audiences:
  - TENANT
areas:
  - Tenant
  - Performance
  - UX
summary: "Home, Shortlets, and Properties now render with tighter skeleton-to-card layout parity, tuned image delivery hints, and smoother mobile sticky-search state updates."
published_at: "2026-02-26"
---

## What changed

- Reduced layout shift by aligning loading skeleton image geometry with final card geometry:
  - properties cards now keep `4:3` skeleton parity
  - shortlets loading cards now use a dedicated shortlet-height skeleton variant.
- Tuned image loading hints on high-traffic rails/cards:
  - added blur placeholders for mobile home rail card images
  - tightened `sizes` hints for shortlets list carousel and properties cards to reduce oversized mobile fetches.
- Reduced mobile scroll work in shortlets search:
  - compact sticky-search state updates are now requestAnimationFrame-throttled and only commit when state actually changes.
