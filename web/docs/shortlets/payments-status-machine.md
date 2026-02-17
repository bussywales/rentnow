# Shortlet Payments Status Machine

This document defines the v1 booking/payment state model for shortlets and the self-healing reconcile flow.

## Enums

### Booking status (`shortlet_bookings.status`)

- `pending_payment`
- `pending`
- `confirmed`
- `declined`
- `cancelled`
- `expired`
- `completed`

### Payment status (`shortlet_payments.status`)

- `initiated`
- `succeeded`
- `failed`
- `refunded`

## Authoritative transitions

### Booking transitions

- Create booking:
  - `pending_payment`
- After successful payment (canonical success function):
  - request mode: `pending_payment -> pending`
  - instant mode: `pending_payment -> confirmed`
- Host decision:
  - `pending -> confirmed` (approve)
  - `pending -> declined` (decline)

### Payment transitions

- Init:
  - `initiated`
- Provider success:
  - `initiated -> succeeded`
- Provider failure:
  - `initiated -> failed`

## Invariants

- Canonical success is centralized in:
  - `markShortletPaymentSucceededAndConfirmBooking(...)`
- Only the canonical success helper may:
  - mark `shortlet_payments.status = succeeded`
  - transition booking post-payment
  - set `confirmed_at`
  - clear reconcile flags
- Success path is idempotent:
  - repeated webhook/verify calls must not double-transition bookings.
- Reconcile metadata fields on `shortlet_payments`:
  - `last_verified_at`
  - `verify_attempts`
  - `needs_reconcile`
  - `reconcile_reason`
  - `reconcile_locked_until`
  - `provider_event_id`
  - `provider_tx_id`
  - `confirmed_at`

## Reconcile flow

Internal route:

- `POST /api/internal/shortlet/reconcile-payments`
- Auth: `x-cron-secret: <CRON_SECRET>`

Selection logic:

- `initiated` payments older than 5 minutes
- rows already marked `needs_reconcile = true`
- `succeeded` rows where booking is still non-terminal at processing time

Worker behavior:

- Acquires row lock via `reconcile_locked_until`.
- Verifies with provider API (Paystack/Stripe).
- Calls canonical success function on provider-paid confirmations.
- Marks failed when provider confirms failure.
- Marks `needs_reconcile=true` with reason on ambiguous/mismatch cases.
- Clears reconcile flags on resolved terminal rows.

## Return-page polling contract

- Keep polling while booking is non-terminal and payment is not `failed/refunded`.
- Do not stop polling only because payment is `succeeded` if booking is still `pending_payment` or `pending`.
- Show:
  - `pending_payment + succeeded`: "Payment received. Finalising your booking..."
  - `pending + succeeded`: "Payment received. Your booking request is now waiting for host approval."

## Debug commands

Vercel logs:

```bash
vercel logs --environment production --since 30m --no-follow --expand --query "/api/internal/shortlet/reconcile-payments"
vercel logs --environment production --since 30m --no-follow --expand --query "/api/shortlet/payments/paystack/verify"
vercel logs --environment production --since 30m --no-follow --expand --query "/api/shortlet/payments/status"
```

Supabase mismatch check (example):

```sql
select
  sp.booking_id,
  sp.status as payment_status,
  sp.updated_at as payment_updated_at,
  sb.status as booking_status,
  sb.updated_at as booking_updated_at
from public.shortlet_payments sp
join public.shortlet_bookings sb on sb.id = sp.booking_id
where sp.status = 'succeeded'
  and sb.status = 'pending_payment'
  and sp.updated_at < now() - interval '2 minutes'
order by sp.updated_at desc;
```
