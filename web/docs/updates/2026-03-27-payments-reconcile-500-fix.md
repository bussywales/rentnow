---
title: Payments reconcile HTTP 500 fix
date: 2026-03-27
audiences:
  - ADMIN
areas:
  - payments
  - ops
  - workflows
summary: Fixed the payments batch reconcile route so the GitHub Actions workflow no longer trips a server-side 500 on the receipts sub-lane.
---

## What was found

The `Payments Reconcile` GitHub Actions workflow was reaching `POST /api/jobs/payments/reconcile`, but the batch route could still fail with HTTP 500 before any per-reference reconciliation summary was returned.

The failure came from the receipt-reconcile query inside the batch job. It used an invalid null-filter shape for `receipt_sent_at`, which could make the receipts sub-lane throw and take down the whole batch request.

## What was fixed

- Replaced the malformed `receipt_sent_at` filter in the payments reconcile batch query with an explicit `is null` filter.
- Applied the same correction to the payments ops snapshot query so admin reconcile tooling uses the same valid receipt-candidate logic.
- Added regression coverage to lock the reconcile query contract.

## Operator impact

- This was a server-side reconcile-path failure, not a GitHub Actions connectivity problem.
- The workflow should now return a normal JSON summary instead of surfacing a batch-level HTTP 500 from the receipt candidate query.

## Rollback

- `git revert <sha>`
