---
title: "Admin bulk listing cleanup"
audiences:
  - ADMIN
areas:
  - Admin
  - Listings
  - Ops
published_at: "2026-03-23"
---

## What changed

- Added selected-row bulk cleanup controls to `/admin/listings`.
- Added `Bulk deactivate` for safe marketplace removal at scale.
- Added guarded `Bulk permanent delete` for safe-only listings that pass the existing protected-history audit.
- Added a bulk preflight summary modal before execution.

## Safety rules

- Bulk cleanup is admin-only.
- V1 is selected rows only. It does not run against an entire filtered result set.
- Bulk deactivate reuses the existing listing lifecycle model:
  - sets listings to `removed`
  - clears marketplace visibility
  - revokes active share links
  - preserves listing history
- Bulk permanent delete reuses the existing single-listing purge guardrails.

## What blocks permanent delete

Permanent delete stays blocked when protected history exists, including:

- bookings
- payments
- leads
- viewing requests
- message threads
- commission agreements
- featured or listing payment history
- property request response history

Listings that are still live or otherwise not yet removed are flagged as `Deactivate first` in the preflight summary.

## Confirmation requirement

Bulk permanent delete now requires:

- an admin reason
- typed confirmation in the form `DELETE N LISTINGS`

The required count is derived from the eligible delete total in the server-side preflight summary.

## Auditability

Bulk cleanup writes a batch summary audit entry with:

- acting admin
- action type
- reason
- selected count
- affected count
- blocked count
- affected listing ids
- blocked listing references

## Rollback

- `git revert <sha>`
