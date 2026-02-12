---
title: "Alerts Ops controls for saved-search email"
audiences:
  - ADMIN
areas:
  - Alerts
  - Ops
cta_href: "/admin/alerts"
published_at: "2026-02-12"
---

## What changed

- Added Alerts Ops controls to `/admin/alerts` with runtime status, last-run telemetry, and manual action buttons.
- Added admin-only test-send endpoint (`POST /api/admin/alerts/test`) for safe digest verification.
- Added kill switch support (`alerts_kill_switch_enabled`) to block all sends regardless of env override.
- Added last-run telemetry persistence to `alerts_last_run_status_json` from `POST /api/admin/alerts/run`.
- Added internal ops runbook: `docs/alerts-v1-ops.md`.

