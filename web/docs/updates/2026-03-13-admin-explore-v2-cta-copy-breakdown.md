---
title: "Admin Explore V2 CTA copy breakdown"
audiences: [ADMIN]
areas: [admin, analytics, explore-v2]
published_at: "2026-03-13"
---

## What changed
- Added a `CTA copy experiment` section to the Explore V2 conversion report in admin.
- Broke out conversion metrics by `default`, `clarity`, `action`, and `unknown` CTA copy variants.
- Extended the Explore V2 CSV export to include `cta_copy_variant` alongside the existing grouped dimensions.

## Why this helps
- Admins can now compare CTA copy experiment performance without inspecting raw analytics payloads.
- Older rows that predate CTA copy tracking remain visible as `unknown` instead of being mixed into `default`.

## Verification
- `npm --prefix web run lint`
- `npm --prefix web test`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e:golive` (Run #1)
- `npm --prefix web run test:e2e:golive` (Run #2)

## Rollback
- Revert commit: `git revert <sha>`.
