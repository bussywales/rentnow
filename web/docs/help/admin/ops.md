---
title: "Admin ops"
description: "Ops-grade guide for webhooks, reconcile, alerts controls, property requests oversight, and system triage."
order: 30
updated_at: "2026-03-16"
---

## Property requests operations

- `/admin/requests` is the request registry plus compact demand-response analytics surface.
- `/admin/requests/[id]` is the admin inspection and moderation view.
- Analytics currently include created, published, open, matched, closed, expired, removed, with-response, zero-response, total responses, response rate, first-response timing, and segment breakdowns.
- Moderation actions are explicit: close, expire, or remove.

## Payments/webhooks/reconcile

- Webhook endpoint verifies provider signatures and stores event history.
- Duplicate webhook payloads are deduped and must not double-activate.
- Reconcile endpoints/jobs verify provider status and recover missed webhooks.
- Receipt sending is deduped to avoid duplicate confirmations.

## Alerts inbox operations

- `alerts_email_enabled`: feature gate.
- `alerts_kill_switch_enabled`: emergency stop regardless of other gates.
- Last-run telemetry is persisted in app settings JSON.
- Test route sends admin-only test digest without mutating alert baselines.

## Product updates sync

- Sync endpoint ingests docs notes and upserts drafts idempotently.
- Audience mapping enforces AGENT + HOST => host audience.
- Invalid notes are skipped and reported, not crash-inducing.

## System health usage

- Check server time and env presence indicators.
- Confirm key toggles before launch windows.
- Use quick links to jump into alerts/payments/settings/request queues.

<Callout type="warning">
If a high-risk system degrades, disable via kill switch/toggle first, then investigate root cause.
</Callout>
