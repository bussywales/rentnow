# RentNow Roadmap

## Product overview
RentNow is a rental marketplace for African cities. It lets tenants discover and save listings, message hosts, and request viewings, while landlords and agents create and manage listings. Admins have read-only operational visibility and gated role management.

## What users can do today
- Browse listings with pricing cadence, trust badges, and discovery helpers.
- Save searches and saved properties (tenant-only gating enforced).
- Message hosts with clear delivery states, cooldowns, and shareable read-only links.
- Landlords and agents create, edit, and submit listings for approval.
- Admins review support snapshots, billing ops, and role management (server-only service role).

## Release history summary (major milestones by tags)
- v1.7.52 (R12): Tenant-side demand funnels across views, saves, enquiries, viewings.
- v1.7.49 (R11.1): Listing views telemetry foundation for analytics.
- v1.7.48 (R11): Landlord/agent analytics dashboards (read-only, no PII).
- v1.7.47 (R10.1): Admin marketplace health analytics (read-only).
- v1.7.33 (R7.7): Pricing UX polish and form layout improvements for listing creation.
- v1.7.32 (R7.6): Rent cadence (monthly/yearly) introduced across cards and detail pages.
- v1.7.31 to v1.7.28 (R7.5): Trust snapshot RPC, browse reliability fixes, and currency UX.
- v1.7.27 to v1.7.24 (R7.2 to R7.4): Messaging share links, telemetry, and UX safety.
- v1.7.23 to v1.7.20 (R7.0 to R7.1): Discovery/detail polish and trust marker fields.
- v1.7.19 to v1.7.15 (R6.9): PWA push alerts, saved search gating, and push reliability.
- v1.7.14 (R6.8): PWA foundation (installable shell + offline).
- v1.7.13 to v1.7.9 (R6.7): Messaging hardening, rate limits, telemetry, and cooldown UX.
- v1.6.x to v1.7.6 (R6.1 to R6.5): Billing ops, provider modes, and Stripe foundations.

## Shipped phases and epics
- R12: Tenant-side demand funnels with explicit coverage and conversion drop-offs.
- R10.1: Admin marketplace health analytics (read-only).
- R11: Landlord/agent analytics dashboards (read-only, no PII).
- R11.1: Listing views telemetry foundation (append-only, no PII).
- R6.7: Messaging hardening, reason codes, cooldown UX, and telemetry.
- R6.8: PWA foundation with offline-safe shell.
- R6.9: Web push alerts, saved search gating, and push reliability tooling.
- R7.0: Browse and property detail UX polish with clearer CTAs.
- R7.1: Trust markers and tenant-visible trust badges via safe RPC.
- R7.2 to R7.4: Messaging share UX and admin telemetry safety.
- R7.5: Trust snapshot parity, browse reliability fixes, and currency UX.
- R7.6: Rent cadence (monthly/yearly) pricing semantics.
- R7.7: Pricing UX polish and listing form refinements.

## In-flight
- Current line: R12 demand funnels shipped (tag v1.7.52-r12-demand-funnels).
- No additional in-flight phases queued.

## Now / Next / Later (approved roadmap)

### Now — Phase 8: Stability, Access Hygiene & Browse Reliability
- Fix pre-login browse/search reliability
- Distinguish empty results vs fetch errors
- Remove dev diagnostics from production UI
- Enforce role hygiene:
  - Tenants should not see landlord/agent-only CTAs
  - Listing creation gated correctly by role
- Fix redirect inconsistencies (Next.js redirect errors)
- No new features, no schema changes

Non-goals:
- No new product features
- No schema changes

### Next — Phase 9: Listing Data Expansion (Trust & Structure)
- Add structured listing attributes:
  - Listing type (apartment, house, studio, etc.)
  - Address breakdown (country, state/region)
  - Property size (value + unit)
  - Year built (optional)
  - Security deposit (amount + currency)
  - Bathroom privacy (private/shared)
  - Pets allowed
- Surface fields in:
  - Listing create/edit (Details step)
  - Property detail page (“Key facts”)
- No new search filters or monetisation changes

Non-goals:
- No new search filters
- No monetisation or billing changes

### Later
- No additional approved phases yet. Awaiting roadmap updates after Phase 9.

## Key architectural and operational decisions
- App lives in `web/` and is built with Next.js (App Router), Tailwind, and Supabase.
- RLS is enforced on all tables; service-role access is server-only and guarded by admin checks.
- Roles are explicit and limited to tenant, landlord, agent, admin (see `web/docs/admin/ROLE_AND_ADMIN_OPS.md`).
- Migrations are idempotent and applied in order (see `web/docs/ops/supabase-migrations.md`).
- Node.js >= 20.9.0 is required for builds and linting.
- Tags are immutable; releases are tracked in tags and `web/docs/VERSIONS.md`.
