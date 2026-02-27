---
title: "Tenants can control saved-search alerts (quiet hours + frequency)"
audiences:
  - TENANT
  - HOST
areas:
  - Tenant
  - Notifications
  - Retention
summary: "Tenant saved-search push alerts now support opt-in controls, instant vs daily frequency, and quiet hours."
published_at: "2026-02-27"
---

## What changed

- Added tenant notification settings for saved-search push alerts with:
  - enable/disable control
  - frequency mode (`Instant` or `Daily digest`)
  - optional quiet hours and timezone
- Added a tenant-only settings API to load and save these preferences.
- Updated saved-search push dispatch to respect tenant preferences, including quiet-hours suppression and daily cap behaviour.

## Behaviour notes

- Defaults preserve existing behaviour for users without preferences:
  - alerts enabled
  - instant mode
  - no quiet hours
- Daily mode enforces at most one saved-search push per local day.
