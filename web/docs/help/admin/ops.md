---
title: "Admin ops"
description: "Ops-grade guide for webhooks, reconcile, alerts controls, property requests oversight, and system triage."
order: 30
updated_at: "2026-03-16"
---

## Property requests operations

- `/admin` now includes a `Requests` control panel shortcut for the request ops surface.
- `/admin/requests` is the request registry plus compact demand-response analytics surface.
- `/admin/requests/[id]` is the admin inspection and moderation view.
- Analytics currently include created, published, open, matched, closed, expired, removed, with-response, zero-response, total responses, response rate, first-response timing, and segment breakdowns.
- Moderation actions are explicit: close, expire, or remove.
- Newly published open requests can trigger targeted responder email alerts for landlords and agents with matching live supply in the same market.

## Analytics operations

- `/admin/analytics` is the analytics hub.
- `/admin/analytics/explore-v2` is the Explore V2 micro-sheet report only.
- Trust cue and CTA copy sections are experiment reads, not proofs of causation.
- `/admin/analytics/host` includes submit-step listing quality telemetry:
  - guidance viewed
  - fix clicks and CTR
  - submit attempts
  - improvement rate
  - average score delta
  - fix clicks by `Basics`, `Details`, and `Photos`

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

## Admin profile notification controls

- `/profile` includes `Email me when a new listing is submitted for review` for admins.
- Use it if you need inbox-style email awareness for new review queue entries.
- The notification fires only when a listing enters `pending`.

## Image optimisation mode control

- `/admin/settings` includes `Image optimisation mode`.
- Use it as an ops lever when optimisation cost or transform volume spikes.
- Modes:
  - `Vercel default`
  - `Disable non-critical`
  - `Disable all shared images`

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
