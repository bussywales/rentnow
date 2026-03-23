---
title: "Shortlets mobile React 418 unblock for admin owner-identity gate"
audiences:
  - ADMIN
areas:
  - Stability
  - Shortlets
  - Mobile
  - Testing
published_at: "2026-03-23"
---

# Shortlets mobile React 418 unblock for admin owner-identity gate

## What was found

The go-live suite was still intermittently failing on `/shortlets?where=Lekki&guests=2` with React `#418` during the mobile shortlets smoke.

The failure was a recurrence of the shortlets mobile hydration boundary issue. The prior hardening reduced the failure rate, but the no-SSR wrapper still promoted the live client shell from a queued microtask. In the warmed full-suite path, that left room for the client tree to diverge too early from the fallback HTML.

## What was fixed

- Replaced the shortlets no-SSR wrapper's queued external-store mount gate with a plain mount effect.
- The shortlets route now keeps the fallback tree for the entire first client render and only swaps to the live shell after mount has committed.
- Updated the unit contract so future edits keep the same post-mount boundary.

## Why the earlier fix was not enough

The earlier fix improved cold-path behavior, but it still relied on a queued microtask to flip the mounted snapshot. That was not a strong enough guarantee under warmed navigation state inside the full go-live suite.

## What remained intentionally excluded

This stabilization batch did not include the parked admin review/listings owner-identity changes. Those remain a separate batch to land only after the baseline gate is clean.

## Rollback

- `git revert <sha>`
