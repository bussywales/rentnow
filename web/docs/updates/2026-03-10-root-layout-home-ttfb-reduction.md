---
title: "Reduced root layout and home pre-HTML blocking work"
audiences: [TENANT, HOST, ADMIN]
areas: [performance, pwa, home]
published_at: "2026-03-10"
---

## What changed
- Reduced startup server fan-out in root layout by batching app settings reads into one query and resolving auth/settings in parallel.
- Made `MainNav` render from lightweight bootstrap props so root layout no longer blocks on nav enrichment queries.
- Reduced home route cold-start serialization by parallelising profile/explore checks and consolidating demo-listing setting lookup.
- Stabilised startup-shell teardown to fade then hide in-place (instead of DOM removal) so client navigation keeps a stable React tree.

## Why
- Cuts time spent on server work before first HTML is returned, reducing perceived blank time on cold starts.
- Keeps auth correctness while moving non-critical enrichment off the critical first-paint path.

## How to verify
- Run cold-start launch and compare first HTML/first paint timing before and after.
- Confirm nav renders immediately and still shows correct role-aware links after hydration.
- Confirm home rails still populate and personalised save/trust signals continue to appear.

## Rollback plan
- Revert commit `perf(app): reduce root layout and home blocking work`.
