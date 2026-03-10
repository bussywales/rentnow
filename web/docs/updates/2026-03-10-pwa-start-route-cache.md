---
title: "Cached anonymous start route fallback for faster cold opens"
audiences: [TENANT, HOST, ADMIN]
areas: [pwa, performance]
published_at: "2026-03-10"
---

## What changed
- Added a dedicated service-worker navigation cache for the exact root start route (`/`) with versioned name `ph-nav-start-v1`.
- Added a guarded network-first strategy for `/` with a short timeout (`1200ms`):
  - try network first
  - fall back to cached `/` when the network is slow/unavailable
- Cache updates for `/` now use a separate anonymous fetch (`credentials: "omit"`) so authenticated HTML is never written into the shared start-route cache.

## Why only `/` in this batch
- The root route is the startup entrypoint where cold-open delay is most visible.
- Other routes (for example `/saved`, `/dashboard`, `/admin`, `/profile`, and auth pages) are user-specific or sensitive and are intentionally not cached as shared HTML in this batch.
- Keeping scope to exact `/` reduces rollout risk while still improving reopen resilience.

## How to verify
- Open the app on a cold start and confirm `/` renders faster when network is flaky/slow.
- Confirm authenticated pages still come from network and are not served from shared HTML cache.
- Confirm non-root navigations continue using existing behaviour (network + offline fallback).

## Rollback
- Revert commit `perf(pwa): cache start route for faster cold opens`.
- If immediate cache invalidation is needed, bump or remove `ph-nav-start-v1`.
