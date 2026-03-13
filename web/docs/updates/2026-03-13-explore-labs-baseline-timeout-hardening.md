---
title: "Explore Labs baseline timeout hardening"
audiences: [TENANT]
areas: [explore-labs, testing, stability]
published_at: "2026-03-13"
---

## What changed
- Hardened the Explore Labs go-live smoke test to wait for the route commit and the visible page contract instead of relying only on `domcontentloaded`.
- Kept the existing runtime-error guards and pager visibility assertions so the smoke still catches real route failures.

## Why this helps
- The built `/explore-labs` route was responding quickly, but the `domcontentloaded` wait was intermittently timing out on a large streamed page response.
- Waiting for the actual shell and pager markers keeps the test meaningful while removing a brittle navigation gate.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (Run #1)
- `npm --prefix web run test:e2e:golive` (Run #2)

## Rollback
- Revert commit: `git revert <sha>`.
