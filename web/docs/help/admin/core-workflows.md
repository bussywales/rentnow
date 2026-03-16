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

## Property requests oversight

- Use `/admin/requests` to review demand health, response coverage, and zero-response stall segments.
- Open `/admin/requests/[id]` to inspect the request, owner context, and private response history.
- Apply explicit controls to close, expire, or remove requests when needed.
- Preserve privacy: seeker demand is not visible to other seekers and contact details stay out of this workflow.

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
