---
title: "Quiet hours now support overnight ranges"
audiences:
  - TENANT
areas:
  - Tenant
  - Notifications
  - UX
summary: "Tenants can now save overnight quiet-hours windows like 22:00–07:00 for saved-search push alerts."
published_at: "2026-02-27"
---

## What changed

- Quiet-hours validation now accepts overnight windows that cross midnight (for example, `22:00` to `07:00`).
- Validation now blocks ambiguous equal start/end times.
- Error copy was updated to clarify that overnight ranges are supported.

## Impact

- Tenants can configure quieter notification windows without workarounds.
- Existing same-day quiet-hours behaviour remains unchanged.
