---
title: Shortlets React 418 recurrence fix
date: 2026-03-21
audiences:
  - ADMIN
areas:
  - stability
  - shortlets
  - mobile
  - testing
---

# Shortlets React 418 recurrence fix

We investigated the recurring go-live failure on `web/tests/e2e/shortlets.mobile.smoke.spec.ts` where the second required run could still fail on `/shortlets?where=Lekki&guests=2` with React `#418`.

## What we found

- The remaining issue was still a hydration boundary problem in the shortlets no-SSR wrapper.
- The earlier hardening reduced the failure rate, but it still allowed the live client shell to win too early under warm module/client conditions.
- That meant the server-rendered fallback and the first client render could still diverge on later full navigations, which is why Run #1 could pass while Run #2 still failed.

## What was fixed now

- The shortlets no-SSR wrapper now keeps the loading fallback through the initial client render and only swaps to the live shell after a queued mount-store notification.
- The hydration contract test was updated to lock that behavior in place.

## Intentionally excluded

- The parked support widget stabilization batch stayed out of this change.
- The parked Payments Guardian follow-up batch stayed out of this change.

## Rollback

- Revert the commit for this batch with `git revert <sha>`.
