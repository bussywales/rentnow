---
title: "Admin guardrails for demo listing featured actions"
audiences: [ADMIN]
areas: [admin, listings, featured]
published_at: "2026-03-11"
---

## What changed
- Added admin UI guardrails to block featuring demo listings before API submission.
- Propagated `is_demo` into admin insights listing/supply health data so demo rows can be disabled correctly.
- Updated admin featured controls to surface explicit copy: `Demo listings can't be featured.`
- Kept unfeature behavior available for already-featured rows.

## Why
- Prevents avoidable `409` errors from feature actions that are known-invalid for demo listings.
- Makes admin behavior consistent with backend policy while reducing failed requests and confusion.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (twice)

## Rollback
- Revert commit: `git revert <sha>`.
