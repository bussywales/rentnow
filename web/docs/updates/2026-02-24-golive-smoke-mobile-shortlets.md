---
title: "Shortlets mobile smoke re-enabled in go-live CI profile"
audiences:
  - TENANT
areas:
  - CI
  - E2E
cta_href: "/shortlets"
published_at: "2026-02-24"
---

## What changed

- Stabilised the `/shortlets` mobile smoke test with deterministic waits for search results and mobile map interactions.
- Re-enabled `shortlets.mobile.smoke.spec.ts` in the go-live smoke profile (`test:e2e:golive`).
- Added runtime error guards in the mobile smoke flow to fail fast on real client-side errors.

## Who it affects

- Tenant:
  - Indirectly benefits from stronger release gating on the highest-traffic mobile shortlets path.

## Where to find it

- `/web/tests/e2e/shortlets.mobile.smoke.spec.ts`
- `/web/playwright.golive.config.ts`
