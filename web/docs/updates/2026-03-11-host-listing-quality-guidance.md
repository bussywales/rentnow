---
title: "Host listing quality guidance in edit and submit flow"
audiences: [HOST]
areas: [listings, quality, host]
published_at: "2026-03-11"
---

## What changed
- Enhanced the host listing stepper quality card on the submit step to show:
  - completeness score
  - quality status (`Strong`, `Fair`, `Needs work`)
  - up to 5 recommended next fixes
- Added supportive copy to nudge improvement before submit without blocking publish/review.
- Added a lightweight photo-step hint when fewer than 3 images are present.
- Kept scoring tied to the shared listing quality helper so host/admin quality signals stay aligned.

## Why this helps hosts and marketplace quality
- Hosts get clear, actionable guidance before submit instead of waiting for admin cleanup feedback.
- Better upstream listing quality should reduce review churn and improve listing consistency for renters.
- Non-blocking guidance preserves publishing momentum while still nudging stronger listing quality.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (twice)

## Rollback
- Revert commit: `git revert <sha>`.
