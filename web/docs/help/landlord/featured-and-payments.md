---
title: "Landlord featured and payments"
description: "Request featured, complete Paystack payment, verify activation, and track receipts."
order: 30
updated_at: "2026-02-13"
---

## Featured request flow

1. From `/host`, click **Request Featured** on an eligible listing.
2. Select duration (7d or 30d) and optional note.
3. Wait for admin decision in featured requests queue.
4. When approved, proceed to payment to activate.

## Eligibility checklist

- Listing is approved (when required by settings).
- Listing is active/visible.
- Listing is not demo.
- Listing meets minimum photos and description quality rules.

## Payment and activation (Paystack)

- Checkout initializes server-side with validated ownership.
- Webhook confirmation is source of truth for settlement.
- Activation is idempotent: no double-feature on replay.
- Reconcile tools exist for delayed/missed webhook scenarios.

## Receipts and history

- Receipt email is sent once after successful settlement.
- Payment history appears in host workspace panel.
- Keep reference IDs for support and reconciliation.

<Callout type="warning">
Do not share secrets or private payment payloads. Share only payment reference and timestamps when escalating.
</Callout>
