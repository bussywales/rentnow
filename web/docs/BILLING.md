# Billing & Plans

This document covers manual billing (admin-driven) and Stripe subscriptions for landlords and agents.

## Plan model
- Plan tiers: `free`, `starter`, `pro`.
- Plans apply to both landlord and agent roles.
- Plan limits are enforced server-side on listing creation/activation.
- `valid_until` drives expiry; if expired, the plan is treated as `free`.

## Data model
`public.profile_plans`
- `plan_tier`: current tier (free/starter/pro)
- `max_listings_override`: optional override
- `billing_source`: `manual` | `stripe` | `paystack`
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

### Plan-to-price mapping
- The mapping is centralized in `web/lib/billing/stripe-plans.ts`.
- If tier-specific price env vars are not set, the role/cadence base price is used for both Starter and Pro.

### Checkout flow
- Endpoint: `POST /api/billing/stripe/checkout`
- Payload: `{ tier: "starter" | "pro", cadence: "monthly" | "yearly" }`
- Only landlord/agent roles can create a Checkout session.
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
- Plan tiers are updated based on metadata (preferred) or price mapping.

### Status handling
- Active/trialing subscriptions set `billing_source = stripe` and update `valid_until`.
- `invoice.payment_failed` keeps access until `current_period_end`, but logs a warning.
- `customer.subscription.deleted` downgrades at period end (no instant revoke if still paid).

## Manual override vs Stripe
- Stripe webhooks sync plan tier and `valid_until`.
- Admins can still apply manual overrides at any time.
- If you want manual control to persist, cancel the Stripe subscription to stop future webhook updates.

## Ops checklist
1) Set Stripe env vars in Vercel.
2) Configure webhook endpoint: `/api/billing/stripe/webhook`.
3) Validate via `/api/debug/env` (Stripe section).
4) Validate `/api/debug/rls` for Stripe columns in `profile_plans`.
