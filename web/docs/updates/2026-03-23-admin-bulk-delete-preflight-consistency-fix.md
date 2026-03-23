---
title: "Admin bulk delete preflight consistency fix"
audiences:
  - ADMIN
areas:
  - Admin
  - Listings
  - Ops
published_at: "2026-03-23"
---

## What inconsistency was found

- The bulk permanent delete modal could update its eligibility summary after the modal had already opened.
- In that state, selected count, eligible count, blocked count, and blocked reasons could reflect a newer preflight while the typed confirmation state still reflected an older count.
- The backend still failed safe, but the destructive UI was not internally trustworthy.

## What changed

- The permanent-delete modal now freezes the selected listing ids when the modal opens.
- One preflight snapshot is loaded for that frozen selection and all destructive copy binds to that same snapshot.
- The confirm button stays disabled while preflight is loading, when no listings are eligible, when the admin reason is empty, or when the typed confirmation does not match the current required phrase.
- If the execution-time safety recheck returns a different preflight, the modal resets the confirmation input, shows the updated summary, and requires confirmation again.

## Snapshot consistency rules

- `Selected`
- `Eligible`
- `Blocked`
- blocked summary chips
- destructive action text
- required confirmation phrase

These now all come from the same frozen preflight snapshot.

## Confirmation binding

- The confirmation phrase always matches the current eligible count.
- Example: `DELETE 6 LISTINGS`
- If the eligible count changes after the initial preview, the old confirmation is invalidated and must be re-entered.

## Rollback

- `git revert <sha>`
