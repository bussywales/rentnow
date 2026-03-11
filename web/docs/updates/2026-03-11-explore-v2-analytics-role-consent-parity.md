---
title: "Explore V2 analytics role + consent parity"
audiences: [TENANT, HOST, ADMIN]
areas: [explore-v2, analytics, consent]
published_at: "2026-03-11"
---

## What changed
- Expanded Explore analytics eligibility from tenant-only to tenant + agent + landlord for:
  - `/api/analytics/explore/settings`
  - `/api/analytics/explore`
- Added analytics consent banner parity on `/explore-v2` by mounting `AnalyticsNoticeBanner` on the page.
- Clarified `/admin/analytics/explore-v2` scope copy to state this is a micro-sheet conversion funnel and rail-level save/share interactions are excluded.

## Why
- Agent and landlord Explore V2 interactions now use the same analytics pipeline as tenants.
- Consent mode now has a visible accept/dismiss path on `/explore-v2`, matching other Explore surfaces.
- Admin operators get clearer interpretation of the conversion report scope.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (twice)

## Rollback
- Revert commit: `git revert <sha>`.
