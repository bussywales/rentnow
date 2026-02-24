---
title: "Go-live smoke profile for stable CI releases"
audiences:
  - ADMIN
  - HOST
  - TENANT
areas:
  - CI
  - E2E
cta_href: "/admin/shortlets/ops"
published_at: "2026-02-24"
---

## What changed

- Added a dedicated Playwright go-live smoke profile that runs only explicitly selected stable smoke specs.
- Quarantined `shortlets.mobile.smoke.spec.ts` from go-live smoke runs until it is stabilised.
- Updated the Playwright workflow smoke step to run `test:e2e:golive`.

## Who it affects

- Admin:
  - Gets a more reliable release gate signal for go-live confidence.
- Host:
  - Indirectly benefits from fewer false-negative CI blocks delaying production fixes.
- Tenant:
  - Indirectly benefits from steadier release quality checks on critical flows.

## Where to find it

- `/web/playwright.golive.config.ts`
- `/.github/workflows/playwright.yml`
