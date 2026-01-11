# Versions

## 2026-01-12 — v1.7.61-r14.1-ops-shortcuts
- Added ops shortcuts links on /admin/support for faster triage navigation.

## 2026-01-12 — v1.7.59-r14.0-push-optin-observability
- Added shared push configuration helper with missing-key reporting (dev/debug only).
- Clarified saved-search push opt-in states (unavailable, enable, finish setup) with tenant-only UI.
- Added admin support visibility for push configuration and dev-only missing-key hints.

## 2026-01-11 — v1.7.54-r12.1-latlong-help-tooltip
- Added latitude/longitude helper tooltip in listing Basics step.
- Documented Google Maps/mobile coordinate guidance with accessible popover.

## 2026-01-11 — v1.7.53-r12.0.1-demand-funnels-build-fix
- TypeScript build depth fix (no behavior change).

## 2026-01-11 — v1.7.52-r12-demand-funnels
- Added tenant-side demand funnel aggregation with explicit coverage flags.
- Surfaced funnel cards in landlord and admin analytics with drop-off highlights.
- Documented funnel verification SQL and “Not available” guardrails.

## 2026-01-11 — v1.7.48-r11-landlord-analytics
- Added landlord/agent analytics dashboard with KPI cards, deltas, and coverage indicators.
- Added admin host analytics view for read-only support checks.
- How to verify: open `/dashboard/analytics` as landlord/agent and `/admin/analytics/host/<id>` as admin; confirm unsupported metrics show “Not available”.

## 2026-01-11 — v1.7.47-r10.1-admin-analytics
- Added admin-only marketplace analytics with KPIs, trends, and system health snapshot.
- Reused data quality and beta readiness helpers with safe “Not available” fallbacks.
- Documented R10.1 as in-progress on the roadmap.

## 2026-01-11 — v1.7.46-r9.4-beta-ops-readiness
- Added admin support beta readiness snapshot with blocker vs non-blocker guidance.
- Expanded beta ops docs with release discipline, rollback, and stop-ship conditions.
- Added guardrail tests for new admin readiness section.

## 2026-01-10 — v1.7.45-r9.3-beta-verification-guardrails
- Added guardrail copy to prevent raw errors from surfacing in listing flows.
- Documented beta smoke checklist, known limits, and troubleshooting notes.
- Added unit coverage for guardrail messaging in listing and dashboard flows.

## 2026-01-10 — v1.7.44-r9.2-alerting
- Added admin alerts inbox with push/messaging/data quality signals and runbook guidance.
- Added admin-only alert dispatch webhook endpoint (disabled by default).
- Documented alerting verification steps and payload safety guardrails.

## 2026-01-10 — v1.7.43-r9.1.10-admin-support-affected-listings
- Added affected listings table to admin support with owner display and missing-field summaries.
- Added unit coverage for affected listing detection and owner label fallback.
- Documented admin QA steps for the affected listings sample.

## 2026-01-10 — v1.7.42-r9.1.9-data-quality-dashboard
- Added admin read-only data quality snapshot with missing metadata counts and samples.
- Included missing-photos metric when derived from property_images.
- Documented QA checks for data quality verification.

## 2026-01-27 — v1.7.38-r9.1.3-beta-guardrails
- Documented beta smoke checklist for the listing stepper (Photos auth flow).
- Added session troubleshooting notes for auth cookie validation.
- Added unit guardrails for Photos-step auth resolution.

## 2026-01-27 — v1.7.38-r9.1.4-details-card-layout
- Reworked Details step into carded sections with a sticky tips panel.
- Grouped property specs, size, deposit, and description fields for clearer hierarchy.

## 2026-01-27 — v1.7.39-r9.1.5-country-dropdown
- Replaced the Basics country field with a searchable ISO country dropdown.
- Updated country label copy and added unit coverage for the new selector.

## 2026-01-27 — v1.7.37-r9.1-layout-lock-photos-auth-fix
- Locked the Basics step into carded sections with a sticky pricing panel.
- Refreshed client auth before save/upload to avoid Photos-step login bounces.
- Added unit coverage for location placement and auth continuity in the stepper.

## 2026-01-27 — v1.7.36-r9-listing-data-expansion
- Added listing detail fields (type, address breakdown, size, deposit, bathroom privacy, pets) to properties schema and forms.
- Surfaced key facts on property detail pages and optional type/size meta on cards.
- Updated property APIs, migration runbook, and unit coverage for new fields.

## 2026-01-27 — v1.7.35-r8-stability-role-hygiene
- Differentiated browse/home fetch errors from empty results and hid diagnostics outside development.
- Removed tenant-facing listing navigation in dashboard header.
- Prevented redirect guard errors from being swallowed in admin entrypoint.

## 2026-01-27 — v1.7.33-r7.7.3.2-airbnb-form-layout
- Reworked Basics step into a two-column layout with a sticky pricing card.
- Grouped pricing and availability fields for clearer hierarchy and spacing.
- Updated layout coverage to validate the pricing card structure.

## 2026-01-27 — v1.7.33-r7.7.3.1-form-bottom-row-layout
- Rebalanced the basics step bottom row into two groups for better spacing.
- Widened the rent period control and kept pricing fields aligned.

## 2026-01-27 — v1.7.33-r7.7.3-form-polish-airbnb
- Polished listing stepper layout, spacing, and error presentation for a cleaner flow.
- Refined mobile button layout and pricing section balance.
- Improved currency dropdown popover alignment and selection highlights.

## 2026-01-27 — v1.7.33-r7.7.1-currency-dropdown
- Replaced currency chips with a searchable dropdown and pinned NGN/USD/GBP.
- Added unit coverage for the new CurrencySelect behavior.

## 2026-01-27 — v1.7.33-r7.7-pricing-rent-ux-polish
- Standardized pricing display with currency symbols and cadence suffixes.
- Clarified rent period inputs with helper text and minimum price validation.
- Added unit coverage for rent period formatting and UI guards.

## 2026-01-27 — v1.7.32-r7.6-rent-cadence-ux
- Added properties.rent_period for monthly/yearly pricing semantics.
- Added rent period controls in listing editor and ensured card/detail displays use / month or / year.
- Added unit coverage for rent period helpers, forms, and migration.

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
## 2026-01-10 — v1.7.41-r9.1.7-country-code-backfill-guardrails
- Added an idempotent backfill to populate property country_code from country names.
- Documented coverage queries and backfill verification steps for ops/QA.
- Added guardrail tests to ensure the backfill only fills missing codes.

## 2026-01-10 — v1.7.40-r9.1.6-country-iso-dualwrite
- Added `country_code` to properties with a safe migration and verification snippet.
- Updated country selection to persist both display name and ISO code.
- Normalized country payloads on create/update with derived code/name fallbacks.
- Added unit coverage for country normalization and migration presence.

## 2026-01-11 — v1.7.49-r11.1-property-views-telemetry
- Added `property_views` append-only telemetry table with role guardrails.
- Recorded listing views on property detail fetch with service-role inserts.
- Wired views counts into admin and landlord analytics helpers.
- Added unit coverage for view aggregation and migration guardrails.

## 2026-01-11 — v1.7.50-r11.2-property-views-guardrails
- Added `viewer_id` to property views with a dedupe-supporting index.
- Skipped owner views and deduped repeat authenticated views within 60 seconds.
- Added guardrail tests plus updated ops verification queries.

## 2026-01-11 — v1.7.51-r11.3-views-accuracy
- Skipped property view inserts on prefetch requests and added inflight dedupe.
- Split listing views into total, unique authenticated, and anonymous counts.
- Added guardrail tests plus analytics copy clarifying anonymous views.

## 2026-01-12 — v1.7.62-r14.2-host-analytics-index
- Added admin host analytics index with search and read-only host list.
- Included safe host labels, listings/threads/views columns, and “Not available” fallbacks.
- Added unit tests and QA checklist steps for the index route.

## 2026-01-12 — v1.7.63-r14.3-admin-push-test
- Added an admin-only test push endpoint targeting the current admin subscriptions only.
- Added a “Send test push” control on `/admin/support` with safe result states.
- Documented admin test push verification in PWA ops and QA checklists.

## 2026-01-12 — v1.7.64-r14.4-push-delivery-telemetry
- Added admin-only delivery telemetry for push test outcomes with safe summary counts.
- Surface recent delivery attempts and zero-state copy under `/admin/support`.
- Documented telemetry smoke checks for ops and QA.
