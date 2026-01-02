# Versions

## 2026-01-01 — v1.6.1-stripe-foundation
- Added billing dashboard entry with Stripe/manual CTA logic.
- Hardened Stripe webhooks with idempotency tracking and price-id plan mapping.
- Preserved manual overrides and documented downgrade behavior.
- Extended billing unit tests for plan mapping and webhook handling.

## 2026-01-01 — v1.6.2-r6.1.3-billing-polish
- Polished the billing hub with premium plan cards and cadence toggle.
- Added pricing clarity and listing usage indicators.
- Simplified upgrade CTA hierarchy and improved role-based plan clarity.

## 2025-12-31 — R5.2.2 Stripe subscriptions
- Added Stripe checkout + webhook + portal endpoints for landlord/agent plans.
- Added Stripe identifiers to `profile_plans` and expanded RLS debug metadata.
- Added Stripe upgrade UI actions with cadence selection and status display.
- Added unit tests for plan mapping and webhook signature verification.
- Documented Stripe and manual billing rules in `docs/BILLING.md`.
