# Payments v1 Ops — Scheduled Reconcile (GitHub Actions on Hobby)

This runbook covers the fallback reconcile job for the canonical Paystack featured activation payments lane.

## Purpose

- Paystack webhooks are primary for canonical featured activation success updates; cron reconcile is fallback safety.
- Keep Featured activation reliable even when webhooks are delayed or missed.
- Reconcile pending/initialized payments and send any missing receipts.
- Provide admin-visible ops status from `/admin/payments`.

## Runtime config assumptions

Canonical Paystack runtime config is provider-settings first.

The job resolves Paystack through the same shared helper used by billing/runtime paths:

- `/admin/settings/billing` selects `paystack_mode`
- stored provider keys in `provider_settings` are preferred
- env keys are explicit fallback only when stored keys are absent

Required operator inputs:

- `CRON_SECRET`
- Paystack keys stored in `provider_settings` for the intended mode, or env fallback keys if stored keys are absent
- `RESEND_API_KEY`

Relevant Paystack env fallback keys:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_SECRET_KEY_TEST`
- `PAYSTACK_SECRET_KEY_LIVE`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_PUBLIC_KEY_TEST`
- `PAYSTACK_PUBLIC_KEY_LIVE`
- `PAYSTACK_WEBHOOK_SECRET`
- `PAYSTACK_WEBHOOK_SECRET_TEST`
- `PAYSTACK_WEBHOOK_SECRET_LIVE`

Optional but recommended:

- `RESEND_FROM`

## Scheduler configuration (Hobby)

Vercel cron is not used on Hobby for this job.

Scheduler source:

- GitHub Actions workflow:
  - `/Users/olubusayoadewale/rentnow/.github/workflows/payments-reconcile.yml`
  - runs every 15 minutes (`*/15 * * * *`)
  - calls `POST /api/jobs/payments/reconcile` with `x-cron-secret`

Alternative external schedulers (if needed) can also call:

- `POST /api/jobs/payments/reconcile` with `x-cron-secret`
- Recommended options: GitHub Actions, cron-job.org, Upstash QStash

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

## Current cutover reality

- canonical featured activation webhook lane is `/api/webhooks/paystack`
- billing subscription backstop, PAYG listing fees, and legacy PAYG featured handling still exist at `/api/billing/webhook`
- the reconcile job is fallback safety, not the primary source of truth

Operators should treat Paystack webhook ingress as a review point during cutover, not as an assumed single-route setup across all lanes.

Quick operator rule:

- if the active live Paystack lane is shortlet NGN or canonical featured activation, the dashboard webhook URL should point to `/api/webhooks/paystack`
- if the active live Paystack lane is subscription backstop or PAYG listing fees, the dashboard webhook URL should point to `/api/billing/webhook`
- do not assume this reconcile job makes both webhook route families interchangeable during cutover

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

For provider readiness and mode verification, also check:

- `/admin/settings/billing`
- `/api/debug/env`

## Idempotency guarantees

- Duplicate webhook payloads are deduped by `(provider, payload_hash)`.
- Activation is idempotent via existing RPC and pending-only transitions.
- Receipts are deduped using `payments.receipt_sent_at`.
