# Billing & Plans

This document covers manual billing (admin-driven), Stripe subscriptions, and tenant premium alerts.

## Plan model
- Landlord/agent tiers: `free`, `starter`, `pro`.
- Tenant tier: `tenant_pro`.
- Plan limits are enforced server-side on listing creation/activation.
- Tenant Pro unlocks unlimited saved searches and instant alerts.
- `valid_until` drives expiry; if expired, the plan is treated as `free`.

## Data model
`public.profile_plans`
- `plan_tier`: current tier (free/starter/pro)
- `max_listings_override`: optional override
- `billing_source`: `manual` | `stripe` | `paystack` | `flutterwave`
- `valid_until`: subscription end or manual expiry
- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_price_id`
- `stripe_current_period_end`
- `stripe_status`

`public.profile_billing_notes` (admin-only)
- Notes visible only to admins.

`public.plan_upgrade_requests`
- Upgrade requests for manual review.

`public.saved_search_alerts`
- Alert audit entries for tenant saved search matches.
- Used to track delivery status and last alert timestamps.

## Manual billing (admin)
- Admins can set plan tier, max listing overrides, and `valid_until` in `/admin/users`.
- Admin actions are logged with `plan_override` events.
- Manual upgrades are applied immediately.

## Stripe subscriptions (self-serve)
### Required env vars
Server-only:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_LANDLORD_MONTHLY`
- `STRIPE_PRICE_LANDLORD_YEARLY`
- `STRIPE_PRICE_AGENT_MONTHLY`
- `STRIPE_PRICE_AGENT_YEARLY`
- `STRIPE_PRICE_TENANT_MONTHLY`
- `STRIPE_PRICE_TENANT_YEARLY`

Optional:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (not required for Checkout redirect flow)
- Tier-specific overrides (optional):
  - `STRIPE_PRICE_LANDLORD_STARTER_MONTHLY`
  - `STRIPE_PRICE_LANDLORD_STARTER_YEARLY`
  - `STRIPE_PRICE_LANDLORD_PRO_MONTHLY`
  - `STRIPE_PRICE_LANDLORD_PRO_YEARLY`
  - `STRIPE_PRICE_AGENT_STARTER_MONTHLY`
  - `STRIPE_PRICE_AGENT_STARTER_YEARLY`
  - `STRIPE_PRICE_AGENT_PRO_MONTHLY`
  - `STRIPE_PRICE_AGENT_PRO_YEARLY`

### Provider mode toggles (test/live)
- Modes are stored in `provider_settings` and managed in `/admin/settings/billing`.
- Stripe key resolution prefers mode-specific keys when present:
  - `STRIPE_SECRET_KEY_TEST` / `STRIPE_SECRET_KEY_LIVE`
  - `STRIPE_WEBHOOK_SECRET_TEST` / `STRIPE_WEBHOOK_SECRET_LIVE`
  - `STRIPE_PRICE_*_TEST` / `STRIPE_PRICE_*_LIVE`
- If mode-specific keys are missing, the single-key env vars above are used as a fallback.
- Paystack/Flutterwave modes are tracked alongside Stripe and default to test when live keys are missing.

### Paystack + Flutterwave provider keys
- Paystack/Flutterwave keys live in `provider_settings` (not in env).
- Admins update them in `/admin/settings/billing` (keys are masked on screen).
- Mode selection is applied per provider; if live keys are missing, the config falls back to test.

### Paystack + Flutterwave test-mode checkout
- Paystack init endpoint: `POST /api/billing/paystack/initialize`
- Paystack verify endpoint: `POST /api/billing/paystack/verify`
- Flutterwave init endpoint: `POST /api/billing/flutterwave/initialize`
- Flutterwave verify endpoint: `POST /api/billing/flutterwave/verify`
- Billing page handles provider return URLs and triggers verification:
  - Paystack expects `reference` (or `trxref`) in the query string.
  - Flutterwave expects `tx_ref` (and optional `transaction_id`) in the query string.
- Verification is idempotent per reference; if already processed it returns `already_processed`.
- Successful verify updates `profile_plans`:
  - `billing_source` set to `paystack` or `flutterwave`
  - `plan_tier` and `valid_until` set based on cadence
  - Manual overrides still win (verification is marked `skipped`).

### Plan-to-price mapping
- The mapping is centralized in `web/lib/billing/stripe-plans.ts`.
- If tier-specific price env vars are not set, the role/cadence base price is used for both Starter and Pro.

### Checkout flow
- Endpoint: `POST /api/billing/stripe/checkout`
- Payload: `{ tier: "starter" | "pro" | "tenant_pro", cadence: "monthly" | "yearly" }`
- Landlord/agent roles can use starter/pro; tenants can use tenant_pro.
- Session metadata includes profile id, role, tier, cadence, and billing source.

### Webhook flow
- Endpoint: `POST /api/billing/stripe/webhook`
- Verified using `STRIPE_WEBHOOK_SECRET`.
- Handles:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- Updates `profile_plans` with Stripe identifiers and `valid_until`.
- Checkout sessions require `user_id` + `plan_tier` metadata; missing metadata is logged as an error and ignored.
- Subscription events rely on price-id mapping and stored Stripe IDs to resolve the profile.

### Webhook audit
- Stripe webhook events are recorded in `stripe_webhook_events` with metadata only (no raw payloads).
- Stored fields include `event_type`, `status`, `reason`, `mode`, `profile_id`, and Stripe identifiers.
- `processed_at` is stamped only when a plan update is applied (or when explicitly marked as handled).

### Provider payment audit
- Paystack/Flutterwave events are recorded in `provider_payment_events`.
- Stored fields include provider, mode, reference, status, plan_tier, profile_id, amount/currency, and `processed_at`.
- Admins can review these in `/admin/billing` under “Provider payment events”.

### Stripe ops viewer + replay
- Admins can review webhook activity in `/admin/billing` with mode/status/date filters.
- Use the replay endpoint for safe reprocessing: `POST /api/admin/billing/stripe/replay` with `{ event_id }`.
- Replays are idempotent: already-processed events will no-op and log a replay attempt.
- Replay audit fields on `stripe_webhook_events`:
  - `replay_count`, `last_replay_at`, `last_replay_status`, `last_replay_reason`.

### Status handling
- Active/trialing subscriptions set `billing_source = stripe` and update `valid_until`.
- `past_due`/`unpaid` keep access until `current_period_end`, but log a warning.
- `customer.subscription.deleted` or expired subscriptions downgrade immediately (set tier to Free, clear `valid_until`).

## Tenant premium alerts
- Tenant Pro users receive instant alerts for saved search matches.
- Alerts are sent when a listing is approved or activated and matches saved search filters.
- Email delivery uses Resend when configured.

### Email env vars
- `RESEND_API_KEY`
- `RESEND_FROM`

## Manual override vs Stripe
- Stripe webhooks sync plan tier and `valid_until` only when `billing_source = stripe`.
- Admins can still apply manual overrides at any time; manual overrides always win.
- If you want manual control to persist, set `billing_source = manual` and cancel the Stripe subscription.

## Ops checklist
1) Set Stripe env vars in Vercel.
2) Configure webhook endpoint: `/api/billing/stripe/webhook`.
3) Validate via `/api/debug/env` (Stripe section).
4) Validate `/api/debug/rls` for Stripe columns in `profile_plans`.

## Live-mode checklist
1) Confirm live price IDs are set in Vercel (`STRIPE_PRICE_*`).
2) Verify webhook signing secret matches the live endpoint.
3) Run a live-mode checkout and confirm:
   - `profile_plans` updates to `billing_source = stripe`
   - `stripe_status` and `stripe_current_period_end` are set
4) Cancel a subscription and confirm immediate downgrade (unless manual override).
5) Re-deliver a webhook event and confirm it is marked as duplicate (no reapply).

## Support playbook (admin billing ops)
- Open `/admin/billing` and search by user email.
- Review the billing snapshot (plan tier, billing source, valid until, Stripe status).
- Use Support actions for manual overrides:
  - Extend valid_until by 30 days for courtesy extensions.
  - Set plan tier to apply an immediate manual upgrade/downgrade.
  - Expire now to revoke access immediately.
- Update billing notes for internal tracking (admin-only).
- Review upgrade requests and approve/reject with a reason.
- Check Stripe webhook events for processed/ignored/failed outcomes and reasons.
- Filter events by mode (test/live) and use replay for failed events when needed.

Manual overrides set `billing_source = manual` and take precedence over Stripe updates.
