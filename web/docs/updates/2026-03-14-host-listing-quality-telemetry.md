---
title: "Host listing quality telemetry"
audiences: [HOST, ADMIN]
areas: [listings, quality, telemetry]
published_at: "2026-03-14"
---

## What changed
- Added lightweight telemetry for the host submit-step listing quality guidance so we can measure whether the new guidance is helping before submission.
- The host flow now records when the submit-step guidance is first shown, when a host clicks a quality fix jump-back action, and the quality score context attached to the submit attempt.
- Reused the existing append-only `property_events` telemetry path instead of introducing a separate analytics store.

## Why this helps improve host UX
- Shows whether hosts actually use `Go to Basics`, `Go to Details`, and `Go to Photos` actions.
- Captures whether listing quality improves between the first submit-step guidance view and the eventual submit attempt.
- Keeps the feedback loop lightweight and operationally simple without changing publish rules or adding blocking UX.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (Run #1)
- `npm --prefix web run test:e2e:golive` (Run #2)

## Rollback
- Revert commit: `git revert <sha>`.
