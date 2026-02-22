---
title: "Go-live smoke pack v1 for shortlets and host booking paths"
audiences:
  - TENANT
  - HOST
  - ADMIN
areas:
  - Shortlets
  - Payments
  - Host
  - Quality
cta_href: "/shortlets"
published_at: "2026-02-22"
---

## What changed

- Added a lean Playwright smoke suite that covers mobile shortlets discovery, desktop map auto/manual behaviour, booking-widget calendar basics, payment-return status transitions, and host inbox urgency checks.
- Added stable `data-testid` hooks on critical UI surfaces so smoke checks avoid brittle selectors.
- Added deterministic wait helpers to reduce flaky sleeps in smoke runs and keep checks CI-friendly.

## Why this matters

- Catching regressions on high-impact flows before release protects conversion and trust.
- The suite is intentionally small and fast enough for routine CI execution.
