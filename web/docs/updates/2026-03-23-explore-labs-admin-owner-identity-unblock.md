---
title: "Explore Labs swipe unblock for admin owner-identity release gate"
audiences:
  - ADMIN
areas:
  - Stability
  - Explore
  - Testing
published_at: "2026-03-23"
---

# Explore Labs swipe unblock for admin owner-identity release gate

## What was found

The go-live suite was intermittently failing in the mobile Explore Labs smoke because the synthetic swipe used by the test could complete without advancing the pager.

The Explore Labs page itself still rendered correctly. The failing path was the swipe assertion remaining at index `0`, which pointed to a brittle mobile test interaction rather than a confirmed product regression.

## What was fixed

- Increased the synthetic mobile swipe distance so it consistently clears the pager release threshold across viewport/layout variance.
- Sent multiple move events through the swipe path instead of relying on a single mid-point move.
- Slightly widened the slide-advance poll window to account for snap timing without changing product behavior.

## Root cause

This is the same blocker family as the earlier Explore Labs swipe issue: mobile gesture-test brittleness caused by the synthetic swipe being too close to the pager’s release threshold.

## What remained intentionally excluded

This stabilization batch did not include the parked admin review/listings owner-identity changes. Those remain separate and can be resumed only after the gate is green again.

## Rollback

- `git revert <sha>`
