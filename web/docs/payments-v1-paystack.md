# Payments v1 (Paystack) — Featured Activations

This runbook documents the v1 payments flow for Featured listings in PropatyHub.

## Scope

- Provider: Paystack
- Product: Featured listing activation (`featured_7d`, `featured_30d`)
- Currency: `featured_currency` app setting (Nigeria launch default should be `NGN`)
- Source of truth: `payments` + `featured_purchases` tables
- Activation source of truth: webhook + `public.activate_featured_purchase(...)`

## Required env vars

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_WEBHOOK_SECRET` (optional; falls back to `PAYSTACK_SECRET_KEY`)
- `RESEND_API_KEY` (for receipts)
- `RESEND_FROM` (optional; defaults to `PropatyHub <no-reply@propatyhub.com>`)

## Routes

- Initialize checkout: `POST /api/payments/featured/initialize`
- Paystack webhook: `POST /api/webhooks/paystack`
- Return page: `/payments/featured/return?reference=<paystack_reference>`
- Status: `GET /api/payments/status?reference=<paystack_reference>`
- Admin payments list: `GET /api/admin/payments`, page at `/admin/payments`

## How activation works

1. Host/agent starts payment from approved featured request.
2. Server creates:
   - `payments` row (`status=initialized`)
   - `featured_purchases` row (`status=pending`)
3. Server calls Paystack initialize and redirects user.
4. Paystack sends webhook (`charge.success`).
5. Webhook verifies signature + verifies transaction server-to-server.
6. Webhook marks `payments.status=succeeded` and calls `activate_featured_purchase(payment_id)`.
7. RPC sets listing featured fields and marks `featured_purchases.status=activated`.
8. Receipt email is sent through Resend.

## Idempotency + safety

- Payment reference is unique (`featpay_<uuid>`).
- `payments.reference` is unique.
- `featured_purchases.payment_id` is unique.
- Duplicate `charge.success` events are safe:
  - if payment already succeeded, webhook returns idempotent success.
  - activation RPC is no-op when purchase is already activated.
- Client callback page does not activate anything; webhook is the source of truth.

## Paystack webhook setup

Configure Paystack webhook URL:

- `https://<your-domain>/api/webhooks/paystack`

Make sure the same secret configured in env is used for signature verification.

## Manual QA

1. Create/approve a featured request in admin queue.
2. As host/agent, open `/host` and click **Pay to activate**.
3. Complete Paystack checkout.
4. Confirm return page shows success and polling resolves.
5. Confirm listing is featured (`is_featured=true`, `featured_until` set).
6. Confirm receipt email delivered.
7. Confirm `/admin/payments` shows the transaction.
