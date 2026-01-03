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
- Plan tiers are updated based on metadata (preferred) or price mapping.

### Status handling
- Active/trialing subscriptions set `billing_source = stripe` and update `valid_until`.
- `invoice.payment_failed` keeps access until `current_period_end`, but logs a warning.
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
