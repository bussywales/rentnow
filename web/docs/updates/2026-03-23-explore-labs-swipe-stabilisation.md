---
title: Explore Labs swipe stabilisation
date: 2026-03-23
audiences:
  - ADMIN
areas:
  - stability
  - explore
  - testing
---

# Explore Labs swipe stabilisation

We investigated the go-live failure on `web/tests/e2e/explore.labs.smoke.spec.ts` where the mobile swipe assertion could stay stuck at slide index `0`.

## What we found

- The failure was caused by a brittle smoke gesture, not by a confirmed Explore Labs route regression.
- The synthetic swipe distance was derived from the gallery layer height, while the pager release threshold is based on the full pager viewport height.
- On some runs, that meant the test dispatched a real swipe sequence that was still too short to trigger a slide advance.
- The server-side `transformAlgorithm` error was not confirmed as causal for this failure and appeared incidental to the failing swipe assertion.

## What was fixed now

- The Explore Labs smoke now dispatches a larger viewport-safe vertical swipe distance that reliably crosses the pager release threshold.
- The product code for Explore Labs was left unchanged in this batch.

## Intentionally excluded

- The parked saved mobile React `#418` fix batch stayed out of this change.
- The parked admin listings registry search, sorting, and filter-state batch stayed out of this change.

## Rollback

- Revert the commit for this batch with `git revert <sha>`.
