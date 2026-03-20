---
title: Branding blueprint resolution
date: 2026-03-20
audiences:
  - ADMIN
areas:
  - docs
  - brand
  - repo-hygiene
---

- Resolved the long-standing loose `Branding Blueprint/` root folder by auditing its contents and distilling the useful brand material into tracked docs.
- Added a tracked brand reference home at `docs/brand/README.md` and `docs/brand/BRAND_GUIDELINES.md`.
- Kept the live tracked brand assets in `web/public/` as the canonical logo, mark, and icon references.
- Moved the old root folder into local-only archive storage at `.local-work/Branding Blueprint` and ignored that archive via `.gitignore`.
- Rollback: `git revert <sha>`
