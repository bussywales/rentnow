---
title: "Explore V2 admin conversion report now includes trust cue variant breakdown"
audiences: [ADMIN]
areas: [admin, analytics, explore-v2]
published_at: "2026-03-11"
---

## What changed
- Extended Explore V2 conversion aggregation to include trust-cue variant conversion rates in `by_trust_cue_variant`.
- Added an admin report section titled `Trust cue experiment` on `/admin/analytics/explore-v2`.
- The section compares `None`, `Instant confirmation`, and `Unknown` (legacy events missing `trust_cue_variant`) using:
  - opens
  - primary clicks
  - primary CTR (`primary_clicked / sheet_opened`)
  - view-details CTR (`view_details_clicked / sheet_opened`)
- Kept CSV export backward-compatible while preserving the `trust_cue_variant` column in grouped output.

## Why
- Makes trust-cue experiment outcomes directly visible in the admin report without inspecting raw event payloads.
- Preserves compatibility with older analytics rows where trust-cue context was not yet recorded.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (twice)

## Rollback
- Revert commit: `git revert <sha>`.
