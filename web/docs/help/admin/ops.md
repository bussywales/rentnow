---
title: "Admin ops"
description: "Ops-grade guide for webhooks, reconcile, alerts controls, and system triage."
order: 30
updated_at: "2026-02-13"
---

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
- Use quick links to jump into alerts/payments/settings queues.

<Callout type="warning">
If a high-risk system degrades, disable via kill switch/toggle first, then investigate root cause.
</Callout>
