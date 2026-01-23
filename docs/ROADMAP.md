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
- Next planned work begins with Phase 13 (Host SLA analytics).

## Future phases (12–17)
These phases build on R9–R11 telemetry and R12 demand funnels to keep analytics truthful, operational, and host-safe.

### Phase 12 — Demand Funnels & Tenant-Side Signals (Shipped)
What ships:
- Tenant-side funnel coverage (views → saves → enquiries → viewing requests)
- Explicit “Not available” handling for missing stages
Why it exists:
- Establishes truth about demand drop-offs without guesswork
Metrics unlocked:
- Funnel counts and conversion rates by listing, host, and marketplace
Non-goals:
- No inferred or fuzzy metrics
- No behavioural profiling or cohorting

### Phase 13 — Host SLA Analytics (Per-host only)
What ships:
- SLA analytics computed per host (landlord/agent), not per listing
- Read-only response rate and first-response timing summary
Why it exists:
- Highlights host responsiveness without exposing tenant details
Metrics unlocked:
- Response rate (per host)
- Median time to first response (per host)
- SLA compliance banding (per host)
Non-goals:
- No per-listing SLA scoring
- No message content exposure or PII
- No penalties or automated enforcement

### Phase 14 — Featured Listings (Flat-fee, time-based)
What ships:
- Flat-fee, time-based featured listing placement
- Duration-bound visibility controls (start/end window)
Why it exists:
- Enables simple monetisation without performance pricing
Metrics unlocked:
- Featured slot utilisation
- Featured listing view counts (where view telemetry exists)
Non-goals:
- No bidding or auction mechanics
- No performance-based or subscription pricing
- No ranking overhauls outside the featured slot

### Phase 15 — Notifications & Trust Nudges (Ops-safe)
What ships:
- Reliability-focused notifications for saved searches and key listing status changes
- Clear opt-in and delivery state transparency
Why it exists:
- Reduces silent failures and improves user trust
Metrics unlocked:
- Delivery success vs unavailable rates
- Opt-in coverage
Non-goals:
- No new channels beyond existing web/email foundations
- No marketing campaigns or growth automation

### Phase 16 — PWA Reliability & Offline Resilience
What ships:
- Stability improvements for offline-safe shell
- Clear offline messaging on critical flows
Why it exists:
- Ensures consistent baseline experience across low-connectivity contexts
Metrics unlocked:
- Offline page usage and cache hit ratios (where telemetry exists)
Non-goals:
- No push expansion or background sync features
- No new client-side tracking

### Phase 17 — Pricing Models (Explicitly deferred)
What ships:
- Decision to defer subscription and performance-based pricing
Why it exists:
- Keeps monetisation simple while demand signals mature
Metrics unlocked:
- None (strategic deferral)
Non-goals:
- No subscription tiers
- No performance-based fees
- No pay-per-lead or revenue-share models

## Key architectural and operational decisions
- App lives in `web/` and is built with Next.js (App Router), Tailwind, and Supabase.
- RLS is enforced on all tables; service-role access is server-only and guarded by admin checks.
- Roles are explicit and limited to tenant, landlord, agent, admin (see `web/docs/admin/ROLE_AND_ADMIN_OPS.md`).
- Migrations are idempotent and applied in order (see `web/docs/ops/supabase-migrations.md`).
- Node.js >= 20.9.0 is required for builds and linting.
- Tags are immutable; releases are tracked in tags and `web/docs/VERSIONS.md`.

## Trust & Verification (NOW)
- R16.6x: Photo trust signals (metadata, tenant-visible badges behind admin toggle).
- R16.7a–c: Location picker with geocoding, pinned-area map preview (flagged).
- **R16.7d — Property Check-in Verification (On-site)**: privacy-safe host check-ins using property pin (no raw GPS stored), distance buckets only, feature-flagged tenant badge, admin clear action, append-only audit of check-ins.
- **R16.7e — Location required to publish (flagged)**: feature-flagged guard that blocks publish unless a pinned area exists (lat/lng or place id + label). Drafts always allowed; admin bypass; clear UX banner linking to location section.
- **R16.7f — Pin privacy polish**: clearer pinned state, richer search results, stronger privacy guardrails (no coords shown to tenants), and better non-configured/flag-off messaging.
- **R16.7h — Location search-first UX**: Location section starts with area search + pinned card/preview, then location fields; privacy guardrails and publish guard unchanged.
- **R16.7j — Location search ranking (Shipped)**: tenant search results score normalized location fields (postal prefix, admin areas, city, country) before existing ordering; host “Location quality” UI defers to R16.7j.1.
- **R16.7k.0 — Host Location quality (Shipped)**: host-only Strong/Medium/Weak location completeness indicator with guidance; no tenant UI changes or new migrations.
- **R16.7k.1 — Location normalization polish (Shipped)**: neighbourhood/admin area priorities tightened for UK/NG and postal code sanitization to avoid mixed values.
- **R16.7k.2 — Location search clarity (Shipped)**: host picker now shows country-aware “Searching in …” banner, postcode hinting, pin-bias guidance, and empty-state actions without changing tenant privacy.
- **R16.7k.3 — Postcode country CTA (Shipped)**: postcode/ZIP/FSA queries suggest a country-specific CTA to set the country in one click, re-search with bias, and auto-hide once applied.
- **R16.8b — Pre-publish nudge (Shipped)**: host-only checklist on submit highlights location quality and photo quick wins with dismissible guidance; no publish guards or tenant changes.
- **R16.8c — Host readiness badge (Shipped)**: host dashboard shows readiness score/tier per listing with quick “Improve” links to location/photos; tenant surfaces unchanged.
- **R16.8d — Host dashboard quick fixes (Shipped)**: readiness issues now surface inline Quick fixes on the host dashboard, deep-linking to the correct editor step; no tenant or publish changes.
- **R16.8e — Host dashboard triage (Shipped)**: default lowest-readiness sorting with filter chips, search, and summary counts, plus Resume setup links based on top issue codes; host-only with no tenant changes.
- **R16.8f — Host saved views (Shipped)**: URL-driven saved views (All/Needs attention/Drafts/Ready) with last-view memory, reset action, and locked microcopy on the host dashboard.
- **R16.8i — Save status + Last updated (Shipped)**: listing wizard shows save/submit status with retry, and host dashboard cards surface “Last updated” relative time; no tenant changes.
- **R16.8g — Host bulk triage (Shipped)**: host dashboard supports multi-select with sticky bulk bar (Resume setup modal, Open up to 5 tabs, Export CSV) and view-scoped select-all; client-only, no backend changes.
- **R16.8g.1 — Bulk open + deeplinks (Shipped)**: bulk “Open up to 5” opens all selected listings (capped at 5) and editor deep-links honour `step=photos`/`focus=location` for resume/quick actions.
- **R16.8g.2 — Bulk open + deeplink guardrails (Shipped)**: editor now reliably starts on Photos/Location via query params and bulk open surfaces pop-up blocked warnings while attempting all tabs.
- **R16.8g.3 — Deep-link + readiness patch (Shipped)**: `?step=photos` now consistently lands on Photos for new/edit flows, and host readiness uses photo count/cover signals to avoid false “add photos” regressions.
- **R16.9 — Review & Publish (Shipped)**: submit step now shows a host-only review card with readiness, last updated, blockers (pin flag), and recommended fixes that deep-link to Photos/Location without changing publish rules.
