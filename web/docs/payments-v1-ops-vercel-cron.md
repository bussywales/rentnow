# Payments v1 Ops — Vercel Cron Reconcile

This runbook covers the fallback reconcile job for Paystack Featured payments.

## Purpose

- Keep Featured activation reliable even when webhooks are delayed or missed.
- Reconcile pending/initialized payments and send any missing receipts.
- Provide admin-visible ops status from `/admin/payments`.

## Required environment variables

- `CRON_SECRET`
- `PAYSTACK_SECRET_KEY`
- `RESEND_API_KEY`

Optional but recommended:

- `PAYSTACK_WEBHOOK_SECRET`
- `RESEND_FROM`

## Vercel cron configuration

`/Users/olubusayoadewale/rentnow/web/vercel.json` includes:

```json
{
  "crons": [
    { "path": "/api/jobs/payments/reconcile", "schedule": "*/15 * * * *" }
  ]
}
```

## Job endpoint

- Route: `POST /api/jobs/payments/reconcile`
- Auth: header `x-cron-secret` must match `CRON_SECRET`

The job scans candidates and verifies each reference with Paystack:

- `status in (initialized, pending)` older than 2 minutes
- `status = succeeded and receipt_sent_at is null` older than 2 minutes

Then idempotently:

1. Marks payment succeeded when paid
2. Activates featured purchase via `activate_featured_purchase`
3. Sends receipt only if `receipt_sent_at` is null

## Manual triggers

### Cron route (service)

```bash
curl -X POST "https://www.propatyhub.com/api/jobs/payments/reconcile" \
  -H "x-cron-secret: $CRON_SECRET"
```

### Admin route (session)

- Route: `POST /api/admin/payments/reconcile`
- Modes:
  - `{ "reference": "..." }`
  - `{ "mode": "batch" }`
  - `{ "mode": "stuck" }`
  - `{ "mode": "receipts" }`

## Ops dashboard

`/admin/payments` now shows:

- Stuck payments count and top stuck rows
- Receipts pending count
- Webhook events table
- Reconcile actions for batch/stuck/receipts/reference

## Idempotency guarantees

- Duplicate webhook payloads are deduped by `(provider, payload_hash)`.
- Activation is idempotent via existing RPC and pending-only transitions.
- Receipts are deduped using `payments.receipt_sent_at`.
