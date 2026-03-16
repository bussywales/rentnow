---
title: "Admin core workflows"
description: "Product updates, featured operations, property requests oversight, and system guardrails."
order: 20
updated_at: "2026-03-16"
---

## Product updates (docs-first)

1. Feature ships with `web/docs/updates/YYYY-MM-DD-*.md` note.
2. Run sync/import on `/admin/product-updates/import`.
3. Validate audiences and publish when ready.
4. Confirm updates appear in relevant role surfaces.

## Help content discipline

- Keep `web/docs/help/**` in sync with product behaviour.
- Use `_no-help-change.md` only for justified non-doc changes.
- Treat help updates as Definition-of-Done, not optional cleanup.

## Analytics workflow

- Start from `/admin/analytics` and use the sibling navigation rather than deep-linking blind.
- Use `/admin/analytics/explore-v2` only for micro-sheet conversion interpretation.
- Remember that Explore V2 conversion excludes rail-level save/share actions.
- Use `/admin/analytics/host` for submit-step listing quality telemetry and host lookups.
- Keep experiment reads stable while trust cue and CTA copy variants are live.

## Property requests oversight

- Use the `Requests` quick link on `/admin`, or open `/admin/requests` directly, to review demand health, response coverage, and zero-response stall segments.
- Open `/admin/requests/[id]` to inspect the request, owner context, and private response history.
- Apply explicit controls to close, expire, or remove requests when needed.
- Preserve privacy: seeker demand is not visible to other seekers and contact details stay out of this workflow.

## Listings quality operations

- Use `/admin/listings` for registry-style triage, not approval decisions.
- Use quality status, quality score sorting, and missing-item quick filters to isolate weak inventory fast.
- Use `/admin/listings/[id]` to confirm why the registry is flagging a listing before escalating or intervening.
- Use `/admin/review` for actual approve, reject, or request-changes decisions.

## Admin notification controls

- Admin review notifications are controlled from `/profile`.
- `Email me when a new listing is submitted for review` only fires when a listing enters `pending`.
- It does not fire on autosaves, ordinary edits, or auto-approved submissions to `live`.

## Featured requests queue

- Triage pending requests by quality + policy constraints.
- Use clear reason templates on reject outcomes.
- Handle stale queue rows (>14 days) with standard rejection copy.
- Confirm approvals align with activation/payment flow.

## Payments + reconcile workflow

- Webhook events are primary source of truth.
- Reconcile is fallback (admin trigger and scheduled job).
- Verify idempotency before replaying any event/reference.
- Escalate with payment reference, property ID, and event logs.

## Alerts operations workflow

- Keep kill switch available for incident response.
- Use “Send test digest” before broad enablement.
- Track last-run JSON telemetry and failed-user counts.
