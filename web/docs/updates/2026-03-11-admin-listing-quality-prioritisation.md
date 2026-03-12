---
title: "Admin listing quality prioritisation with filter and score sorting"
audiences: [ADMIN]
areas: [admin, listings, quality]
published_at: "2026-03-11"
---

## What changed
- Added a `Quality filter` control to the admin listings registry with: `All`, `Strong`, `Fair`, and `Needs work`.
- Added a `Quality sort` control to sort by score (`high to low` or `low to high`) without changing existing default order.
- Reused the shared listing quality score/status payload so no duplicate threshold logic was introduced.
- Added a compact visible-row summary so admins can see the impact of active quality filter/sort state.

## Why this helps moderation and ops
- Admins can quickly isolate weak listings and prioritize intervention work.
- Quality-first sorting makes low-quality and high-quality inventory review faster during moderation passes.
- Keeping shared quality logic avoids drift between registry behavior and inspector/host quality signals.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (Run #1)
- `npm --prefix web run test:e2e:golive` (Run #2)

## Rollback
- Revert commit: `git revert <sha>`.
