# Payments v1 (Paystack) — Featured Activations

This runbook documents the canonical v1 payments flow for approved Featured request activations in PropatyHub.

## Scope

- Provider: Paystack
- Product: Featured listing activation (`featured_7d`, `featured_30d`)
- Currency: `featured_currency` app setting (Nigeria launch default should be `NGN`)
- Canonical source of truth for approved featured-request activations: `payments` + `featured_purchases` tables
- Activation source of truth: webhook + `public.activate_featured_purchase(...)`

## Canonical config model

Paystack runtime configuration is now provider-settings first.

Canonical runtime source:

- `provider_settings` row managed in `/admin/settings/billing`
- mode is chosen from `paystack_mode`
- the app resolves stored test/live keys first

Explicit env fallback still remains for safe rollout and ops continuity when stored keys are absent:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_SECRET_KEY_TEST`
- `PAYSTACK_SECRET_KEY_LIVE`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_PUBLIC_KEY_TEST`
- `PAYSTACK_PUBLIC_KEY_LIVE`

Webhook secret precedence is:

1. `PAYSTACK_WEBHOOK_SECRET_<MODE>`
2. `PAYSTACK_WEBHOOK_SECRET`
3. resolved Paystack secret key for the active mode

This means env is still relevant for webhook signing and fallback, but it is no longer the primary runtime source of truth.

## Required operator inputs

- active Paystack mode chosen in `/admin/settings/billing`
- stored Paystack keys in `provider_settings` for the intended mode
- webhook secret env if using a dedicated signing secret
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

Current repo reality:

- canonical featured activation and shortlet webhook route: `POST /api/webhooks/paystack`
- billing subscription backstop and legacy billing events also exist at: `POST /api/billing/webhook`

Operator guidance:

- do not assume Paystack ingress is fully simplified to one route across every lane
- verify which webhook ingress is being used for the intended launch lane before live cutover
- if using a dedicated webhook signing secret, make sure the matching `PAYSTACK_WEBHOOK_SECRET[_TEST|_LIVE]` env is present

For the canonical featured-activation lane documented here, the expected webhook URL is:

- `https://<your-domain>/api/webhooks/paystack`

If webhook delivery or signing looks wrong, check in this order:

1. `/admin/settings/billing` mode and stored keys
2. `PAYSTACK_WEBHOOK_SECRET[_TEST|_LIVE]` or `PAYSTACK_WEBHOOK_SECRET`
3. reconcile fallback via the scheduled payments job

## Manual QA

1. Create/approve a featured request in admin queue.
2. As host/agent, open `/host` and click **Pay to activate**.
3. Complete Paystack checkout.
4. Confirm return page shows success and polling resolves.
5. Confirm listing is featured (`is_featured=true`, `featured_until` set).
6. Confirm receipt email delivered.
7. Confirm `/admin/payments` shows the transaction.
8. If verification fails, confirm the active mode, stored keys, and webhook secret precedence before rotating or changing provider settings.
