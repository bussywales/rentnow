# Versions

## 2026-01-27 — v1.7.31-r7.5.4-detail-trust-badges
- Isolated property detail trust snapshot fetching from personalization failures.
- Added unit coverage to ensure trust badges render only when a snapshot exists.

## 2026-01-27 — v1.7.30-r7.5.5-browse-cache-bypass
- Disabled cached browse API responses when a user session cookie is present.
- Added unit coverage to verify authed browse requests bypass cache.

## 2026-01-26 — v1.7.30-r7.5.4-browse-auth-cookie
- Forwarded auth cookies to the browse API so logged-in users bypass anonymous early-access gating.
- Added unit coverage to ensure browse fetch includes the cookie header.

## 2026-01-25 — v1.7.30-r7.5.3-browse-trust-parity
- Included admin hosts in trust snapshot RPC for public badges.
- Prevented zero-result browse pages from surfacing diagnostics in production.
- Standardized property detail trust badges to use the public snapshot helper.

## 2026-01-24 — v1.7.30-r7.5.2-auth-ui-polish
- Synced navigation links with client auth state changes to avoid stale menus after login.
- Auto-refresh onboarding session checks to clear the email confirmation banner promptly.

## 2026-01-23 — v1.7.29-r7.5.1-trust-snapshot-rpc
- Added get_trust_snapshot RPC for public trust badges with anon access grants.
- Updated trust snapshot helper to use the new RPC on property browse and detail pages.

## 2026-01-22 — v1.7.28-r7.5-trust-currency-ux
- Replaced currency text inputs with a searchable dropdown and pinned NGN/USD/GBP options.

## 2026-01-21 — v1.7.27-r7.4-share-ops-telemetry
- Marked invalid share attempts as not tracked in admin support.
- Added structured logging for share access outcomes.
- Added unit coverage for share logs and telemetry copy.

## 2026-01-20 — v1.7.26-r7.3-share-ux-safety
- Added share link status handling (active/expired/revoked/invalid) with login redirect.
- Tracked share link access timestamps and tightened share telemetry in admin support.
- Added unit coverage for share status helpers, migration, and admin telemetry UI.

## 2026-01-19 — fix: scope message share policies to authenticated
- Scoped message share RLS policies to authenticated roles (defense in depth).
- Added runbook check for message share policy roles.

## 2026-01-18 — v1.7.24-r7.2-messaging-ux
- Added quick replies and per-thread drafts with autosave/restore behavior.
- Added read-only share links for message threads with secure tokens and expiry.
- Added tests and ops runbook notes for messaging UX helpers and share links.

## 2026-01-17 — v1.7.23-r7.0.1-admin-properties-ui-cleanup
- Aligned the admin properties moderation list with a single bulk action bar.
- Standardized row layout with checkbox and inline reject details.

## 2026-01-16 — v1.7.22-r7.1.1-trust-public-badges
- Added a security-definer trust snapshot RPC for tenant-visible badges without widening profile RLS.
- Wired browse and property detail to display host trust badges for tenants via the snapshot.
- Added unit coverage for trust snapshot mapping and migration safety.

## 2026-01-15 — v1.7.21-r7.1-trust-markers
- Added profile trust marker fields with safe defaults and read-only admin visibility.
- Rendered trust badges on host listings and property detail host cards when available.
- Added unit coverage for trust marker formatting, summary counts, and migration presence.

## 2026-01-14 — v1.7.20-r7.0-discovery-detail-polish
- Polished browse cards with consistent location/price/facts formatting and role-aware empty-state CTAs.
- Improved property detail layout with back-to-results affordance and clearer pricing/amenities.
- Added unit coverage for discovery formatting helpers and empty-state CTA mapping.

## 2026-01-06 — v1.7.19-r6.9.3-saved-search-discovery
- Added tenant-only saved-search navigation with friendly non-tenant fallback copy.
- Made “List a property” CTAs role-aware and aligned listing guards with role error codes.
- Added unit coverage for role-aware CTAs, saved-search navigation, and listing access checks.

## 2026-01-13 — v1.7.18-r6.9.2-saved-search-gating
- Scoped saved-search creation to tenants with clear role/limit reason codes.
- Updated push alert verification query docs to use `user_id`.
- Added unit coverage for saved-search gating and verification snippets.

## 2026-01-12 — v1.7.17-r6.9.2-push-durability
- Added stale push subscription pruning markers with admin telemetry counts.
- Added push alert retention cleanup function and documented ops/QA steps.
- Added unit coverage for pruning markers and retention verification.

## 2026-01-11 — v1.7.16-r6.9.1-push-e2e
- Hardened push subscription UI with clearer error states and status refresh.
- Standardized push alert outcome markers and added push reliability telemetry summaries.
- Added unit coverage for push APIs and push outcome markers, plus debug env flags.

## 2026-01-10 — fix: tighten push subscription RLS policies
- Scoped push subscription policies to the authenticated role only.
- Kept ownership checks enforced via `auth.uid()` on all write paths.

## 2026-01-10 — v1.7.15-r6.9-pwa-push-alerts
- Added Web Push subscriptions model with RLS and server APIs for subscribe/unsubscribe/status.
- Extended saved-search alerts with optional push delivery and failure auditing.
- Added push observability to admin support plus a user-facing push status badge.
- Extended PWA service worker for push handling and refreshed PWA/QA runbooks.

## 2026-01-09 — v1.7.14-r6.8-pwa-foundation
- Added installable PWA manifest, icons, and service worker shell caching.
- Added offline fallback route and lightweight offline indicator.
- Added PWA ops runbook notes and QA checklist coverage.

## 2026-01-08 — fix: throttle telemetry column naming
- Renamed messaging throttle telemetry column from reserved `limit` to `max_sends`.
- Updated telemetry insert payloads and RLS/debug checks to match the schema.
- Updated throttle telemetry verification snippets to use `to_regclass`.

## 2026-01-08 — v1.7.13-r6.7.5-messaging-telemetry
- Added durable messaging throttle telemetry table with admin read-only policies.
- Recorded rate-limited send attempts server-side and surfaced counts in admin support.
- Added throttle telemetry tests plus ops/QA runbook updates.

## 2026-01-07 — v1.7.12-r6.7.4-messaging-cooldown
- Added client-side cooldown UX for messaging rate limits with countdown and auto re-enable.
- Disabled composer interactions while cooling down to prevent repeated sends.
- Added cooldown helper unit tests and updated messaging ops runbook.

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
