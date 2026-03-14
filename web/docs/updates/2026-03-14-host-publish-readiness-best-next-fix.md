---
title: "Host publish readiness best-next-fix guidance"
audiences: [HOST]
areas: [listings, quality, host]
published_at: "2026-03-14"
---

## What changed
- Enhanced the host submit step with a clearer publish-readiness summary that highlights the single best next fix before submission.
- Added up to three prioritized quality fixes on the submit step and mapped each one back to the relevant editing step.
- Added lightweight jump-back actions so hosts can move directly to Basics, Details, or Photos to resolve the highest-priority issue.

## Why this helps hosts
- Hosts can now see the most important improvement to make before submit instead of scanning a longer generic missing-items list.
- The guidance stays supportive and non-blocking while making weak listings easier to strengthen quickly.
- The fix ranking reuses the shared listing quality system, so publish-readiness guidance stays aligned with the rest of the marketplace quality logic.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (Run #1)
- `npm --prefix web run test:e2e:golive` (Run #2)

## Rollback
- Revert commit: `git revert <sha>`.
