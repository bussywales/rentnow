---
title: "Admin listing quality visibility in registry and inspector"
audiences: [ADMIN]
areas: [admin, listings, quality]
published_at: "2026-03-11"
---

## What changed
- Added a compact `Quality` signal to the admin listings registry table, showing completeness score and status (`Strong`, `Fair`, `Needs work`).
- Added a fuller `Listing quality` section to the admin listing inspector with score, missing core items (up to 5), and a concise checklist breakdown.
- Reused the shared listing quality helper for both surfaces and added server-side data plumbing so quality output stays consistent across registry and inspector.

## Why this helps moderation and operations
- Admins can identify low-quality listings directly in the registry without opening every row.
- Inspector now explains exactly why a listing is weak, making follow-up actions faster and more consistent.
- Shared scoring reduces drift between admin surfaces and host-facing quality guidance.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (twice)

## Rollback
- Revert commit: `git revert <sha>`.
