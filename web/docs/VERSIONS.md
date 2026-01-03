# Versions

## 2026-01-03 — v1.7.6-r6.5-provider-expansion
- Added reusable Payments mode badge for billing/admin surfaces with TEST/LIVE messaging.
- Added Paystack/Flutterwave key storage in provider_settings with masked admin UI.
- Added mode-aware Paystack/Flutterwave config helpers and stub initialize endpoints.
- Expanded debug env/rls checks and unit coverage for provider mode fallbacks.

## 2026-01-03 — v1.7.5-r6.4.3-stripe-ops
- Added mode-aware Stripe webhook viewer filters with pagination and processed_at visibility.
- Added admin replay endpoint with idempotent processing and replay audit fields.
- Added live-mode safety banner with one-click switch back to test mode.

## 2026-01-03 — v1.7.4-r6.4.2-provider-modes
- Added provider settings singleton with test/live toggles for Stripe/Paystack/Flutterwave.
- Added admin billing settings page for mode controls and env readiness visibility.
- Made Stripe config resolution mode-aware with safe fallbacks to single-key env vars.
- Added debug/env provider mode + dual-key presence reporting and unit coverage.

## 2026-01-03 — v1.7.3-r6.4.1-stripe-go-live
- Hardened Stripe webhook idempotency, audit metadata, and processed_at stamping.
- Enforced checkout metadata requirements and clarified plan status transitions.
- Added Stripe status indicators in billing UI and expanded go-live checklist.

## 2026-01-03 — v1.7.2-r6.3.2-support-polish
- Added billing ops triage filters and per-user Stripe event panel for support.
- Added masked support snapshot and copy-to-clipboard tooling for admin tickets.
- Required reasons and confirmations for admin billing actions with notes logging.

## 2026-01-02 — v1.7.1-r6.3.1-billing-ops
- Added admin billing ops hub with email lookup, snapshot, and manual actions.
- Added upgrade request queue actions with required rejection reason.
- Expanded Stripe webhook audit metadata and read-only admin viewer.
- Added billing ops unit tests for masking and validation helpers.

## 2026-01-02 — v1.7.0-r6.2-tenant-premium
- Added Tenant Pro plan tier with Stripe pricing support.
- Enforced saved search limits for free tenants and unlimited searches for Tenant Pro.
- Added saved search alert audit table and email alert dispatch on new approvals.
- Added tenant upsell prompts and priority contact CTA on listings.
- Centralized early-access gating logic with unit coverage for tenant/free behavior.
- Added Resend guard for alert dispatch with safe 503-style handling and unit coverage.

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
