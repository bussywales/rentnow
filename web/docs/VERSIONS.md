# Versions

## 2026-01-06 — v1.7.11-r6.7.3-messaging-guardrails
- Added lightweight messaging rate limiting with retry guidance and support CTA.
- Surfaced throttling events in admin support diagnostics with filters and rollups.
- Added unit coverage for rate limiting, payload metadata, and admin filtering.
- Updated messaging ops runbook with rate limit configuration and support steps.

## 2026-01-05 — v1.7.10-r6.7.2-messaging-ux-polish
- Standardized messaging reason codes and UI copy with actionable CTAs.
- Added messaging snapshot filters and richer restricted-case context for admins.
- Added tests for permission payloads, reason code mapping, and snapshot stability.
- Updated messaging ops runbook with reason codes and support guidance.

## 2026-01-04 — v1.7.9-r6.7.1-messaging-hardening
- Added explicit message delivery states and clearer in-app messaging rules.
- Hardened message permissions with user-facing block reasons and no silent send failures.
- Added admin-only messaging observability snapshot (read-only) on Support.
- Added unit coverage for messaging permissions and observability.

## 2026-01-04 — v1.7.9-r6.7-admin-users-api-tests
- Added a testable admin users API handler for regression coverage.
- Added unit coverage for admin/non-admin access to `/api/admin/users`.
- Documented admin users API response expectations in the ops runbook.

## 2026-01-04 — v1.7.8-r6.6.1-role-truth-fix
- Added onboarding completion flags to make role state explicit.
- Updated onboarding to persist role + completion state for tenant/landlord/agent.
- Made Admin → Users show “Incomplete” when onboarding is not finished.
- Added an auth.users trigger to auto-create missing profile rows.

## 2026-01-04 — docs: admin role ops runbook
- Documented admin role management steps, API shape, and emergency recovery SQL.
- Added a role source-of-truth section and verification checklist.

## 2026-01-04 — v1.7.7-r6.6-paystack-flutterwave-testmode
- Added Paystack + Flutterwave init/verify flows with plan application and manual override safety.
- Added provider payment events audit table and admin viewer for Paystack/Flutterwave activity.
- Added billing UI actions for Paystack/Flutterwave when keys are configured.
- Added provider-payment unit coverage for idempotency and manual override behavior.

## 2026-01-03 — v1.7.7-r6.6-admin-roles
- Added admin-only role management API with audit logging.
- Ensured profiles default to tenant and unknown roles route to onboarding.
- Added role change controls in Admin → Users and role label normalization in admin views.

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
