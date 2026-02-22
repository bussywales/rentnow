---
title: "Go-live smoke pack adds host calendar and reminders endpoint coverage"
audiences:
  - HOST
  - ADMIN
areas:
  - Host
  - Shortlets
  - Quality
cta_href: "/host/calendar"
published_at: "2026-02-22"
---

## What changed

- Expanded Playwright smoke checks with a host calendar block/unblock flow.
- Added a smoke check for the internal shortlet reminders endpoint using the cron secret contract.
- Updated CI Playwright workflow to pass `PLAYWRIGHT_CRON_SECRET` from `CRON_SECRET` for secure reminders smoke execution.

## Why this matters

- Protects host operations regressions before release.
- Verifies the reminders automation path remains callable and correctly configured in CI.
