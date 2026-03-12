---
title: "Admin listing quality missing-item filters"
audiences: [ADMIN]
areas: [admin, listings, quality]
published_at: "2026-03-12"
---

## What changed
- Added missing-item quick filters to the admin listings registry for `Missing cover image`, `Missing minimum images`, `Missing description`, `Missing price`, and `Missing location`.
- Kept the existing quality status filter and quality score sort in place so admins can combine overall quality triage with a specific missing-item gap.
- Reused the shared listing completeness payload already attached to each registry row instead of recalculating missing-item rules in the table UI.

## Why this helps ops triage
- Admins can now isolate a specific class of weak listing in one step instead of opening low-quality rows one by one.
- Combining status and missing-item filters makes review passes more targeted, for example `Needs work` plus `Missing cover image`.
- Shared filtering logic keeps registry behavior aligned with the underlying listing quality system.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (Run #1)
- `npm --prefix web run test:e2e:golive` (Run #2)

## Rollback
- Revert commit: `git revert <sha>`.
