---
title: "Notification settings now validate more clearly"
audiences:
  - TENANT
areas:
  - Tenant
  - Notifications
  - UX
summary: "The Save button now stays disabled until quiet-hours inputs are valid, and quiet-hours errors only appear after interaction."
published_at: "2026-02-27"
---

## What changed

- The **Save settings** button is now disabled while quiet-hours inputs are invalid.
- Quiet-hours validation messages now appear only after user interaction (or save attempt), not immediately on load.
- A neutral helper clarifies that overnight ranges like `22:00–07:00` are supported.

## Impact

- Tenant notification settings feel calmer and clearer, with fewer premature error states.
- Existing quiet-hours rules and API behaviour remain unchanged.
