---
title: "Admin bulk delete 50-selection investigation fix"
audiences:
  - ADMIN
areas:
  - Admin
  - Listings
  - Ops
published_at: "2026-03-23"
---

## What was found

- Bulk permanent delete did not have a 50-item validation cap.
- The backend rebuilt purge eligibility by auditing every selected listing one by one.
- At larger selections that created a sharp dependency-query fan-out during preflight and execute-time recheck.

## What changed

- The dependency audit now batches selected listing ids per dependent table instead of running one full dependency scan per listing.
- Bulk purge still re-checks eligibility at execute time, but it now does so with a batched dependency summary.
- The route contract is unchanged for admins: same preflight summary, same confirmation phrase, same safety rules.

## Why this is safer

- The fix keeps the existing protected-history rules intact.
- It reduces backend load for larger selected batches without weakening delete guardrails.
- Added regression coverage for a safe 50-listing purge path.
