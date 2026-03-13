---
title: "Explore V2 CTA copy experiment"
audiences: [TENANT, HOST, ADMIN]
areas: [explore-v2, conversion, analytics]
published_at: "2026-03-13"
---

## What changed
- Added a variant-driven CTA copy experiment for the Explore V2 micro-sheet primary action.
- Introduced the `explore_v2_cta_copy_variant` app setting with three variants: `default`, `clarity`, and `action`.
- Kept CTA meaning intent-aware and truthful: shortlets can vary between `Book`, `Check availability`, and action-oriented booking language, while rent and buy continue to use viewing-request language.
- Extended Explore V2 analytics ingestion to store `cta_copy_variant` on micro-sheet events for later reporting and experiment comparison.

## Why this is safe
- The experiment only changes micro-sheet presentation copy; it does not change the action target or booking/viewing flow.
- Labels stay tied to real intent semantics, and `Book instantly` is only shown for instant-book shortlets.
- The variant is reversible through admin settings or by reverting the commit.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (Run #1)
- `npm --prefix web run test:e2e:golive` (Run #2)

## Rollback
- Revert commit: `git revert <sha>`.
- Or switch `explore_v2_cta_copy_variant` back to `default`.
