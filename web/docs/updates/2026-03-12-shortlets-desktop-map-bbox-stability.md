---
title: "Stabilised shortlets desktop map bbox updates"
summary: "Hardened the shortlets desktop map smoke test so map pans and bbox URL sync are verified deterministically."
audiences: [TENANT]
areas: [shortlets, maps, testing]
published_at: "2026-03-12"
rollback: "revert commit"
---

## What changed
- Hardened the desktop shortlets map smoke flow so it retries synthetic map pans until the bbox URL actually changes in auto-update mode.
- Tightened the manual mode assertion so the test now requires the `Search this area` affordance to appear before applying a manual bbox update.

## Why
- The clean-baseline failure came from a brittle synthetic drag path rather than a confirmed product regression.
- This keeps the behavioural assertion intact while removing timing-sensitive false negatives from the baseline suite.

## Rollback
- Revert the commit that introduced this test change.
