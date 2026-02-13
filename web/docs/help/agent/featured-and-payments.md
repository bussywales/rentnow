---
title: "Agent featured and payments"
description: "How agents request featured placements, activate after approval, and reconcile payment issues."
order: 30
updated_at: "2026-02-13"
---

## Request-to-activation path

1. Request featured from listing controls.
2. Wait for admin review outcome.
3. Complete Paystack payment when approved.
4. Confirm activation and receipt status.

## Plan selection guidance

- 7-day plan for short campaign bursts.
- 30-day plan for sustained demand windows.
- Use featured only on listings with strong quality and response readiness.

## Payment reliability controls

- Webhook processing is primary.
- Reconcile is fallback for delayed webhook events.
- Activation and receipt sending are idempotent by design.

## Handling failures

- Keep payment reference IDs.
- Ask admin ops to run reconcile by reference.
- Verify listing eligibility if activation is not visible.

## Related guides

- [Admin ops](/help/admin/ops)
- [Agent success tips](/help/agent/success-tips)
