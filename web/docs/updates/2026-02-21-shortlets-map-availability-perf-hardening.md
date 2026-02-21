---
title: "Shortlets map and availability performance hardening"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - Search
  - Performance
  - Shortlets
published_at: "2026-02-21"
---

## What changed

- Shortlets map performance controls are now centralized behind config knobs for clustering and marker icon cache behavior.
- Booking availability prefetch policy is now centralized and progressive scheduling is easier to tune for slower networks.
- Debug-only diagnostics were added for map and availability fetch scheduling when `debug=1` is present.

## Impact

- No booking, payment, or listing logic changed.
- Existing UX and result behavior stay the same by default; this change improves observability and protects against regressions.
