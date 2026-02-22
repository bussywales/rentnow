# Shortlets Next 4 Weeks

Last updated: 2026-02-21

## Where we are now
- Search/discovery is canonical on `/shortlets` with URL-driven state in `/Users/olubusayoadewale/rentnow/web/components/shortlets/search/ShortletsSearchShell.tsx` and `/Users/olubusayoadewale/rentnow/web/lib/shortlet/search-ui-state.ts`.
- Search API is paged and debug-instrumented in `/Users/olubusayoadewale/rentnow/web/app/api/shortlets/search/route.ts` with pipeline helpers in `/Users/olubusayoadewale/rentnow/web/lib/shortlet/search-pipeline.ts`.
- Booking widget calendar already enforces unavailable-date rules via `/Users/olubusayoadewale/rentnow/web/components/properties/ShortletBookingWidget.tsx` and `/Users/olubusayoadewale/rentnow/web/lib/shortlet/availability.ts`.
- Property detail route is `/Users/olubusayoadewale/rentnow/web/app/properties/[id]/page.tsx`; current public path still depends on API URL resolution and optional auth/profile loading.
- Host inbox is canonical on `/host/bookings` via `/Users/olubusayoadewale/rentnow/web/app/host/bookings/page.tsx` and `/Users/olubusayoadewale/rentnow/web/components/host/HostShortletBookingsPanel.tsx`.
- Host shortlet APIs already exist for blocks/settings/bookings in `/Users/olubusayoadewale/rentnow/web/app/api/shortlet/*`.

## What’s world-class already
- Canonical `/shortlets` + deep-link round-trip to `/properties/[id]` with back context.
- Filters drawer + compact sticky search controls + clean active-filter summaries.
- Map/list coupling with manual and auto area-search modes.
- CTA truthfulness on cards/map previews (Reserve/Request/View based on bookability).
- Availability-aware datepicker with hard prevention of invalid ranges.
- Server-authoritative `availability_conflict` handling at booking creation.
- Return-status confidence flow (polling/realtime + grace recheck) in payments return UI.
- Host bookings nav badge wired to canonical pending policy helper.
- Unified carousel interaction foundation across core surfaces.
- Image optimization foundations (derivative paths + Next image guard script).

## Biggest gaps / risks (ranked)
- `P0` Property detail still logs auth/session noise for signed-out guests (`/Users/olubusayoadewale/rentnow/web/lib/auth.ts`, `/Users/olubusayoadewale/rentnow/web/app/properties/[id]/page.tsx`).
- `P0` Property detail fetch can fail hard when site URL env is wrong (`/Users/olubusayoadewale/rentnow/web/app/properties/[id]/page.tsx`, `/Users/olubusayoadewale/rentnow/web/lib/env.ts`).
- `P0` Host inbox ordering is not urgency-first for awaiting approvals (`/Users/olubusayoadewale/rentnow/web/lib/shortlet/shortlet.server.ts`, `/Users/olubusayoadewale/rentnow/web/components/host/HostShortletBookingsPanel.tsx`).
- `P0` No host calendar route for visual availability command centre.
- `P1` Main nav host badge path does heavy server reads each render.
- `P1` Shortlet search still performs additional in-memory pruning after DB fetch.
- `P1` Notifications panel is keyboard-improved but still not a full focus trap.
- `P1` Host payments view is featured-payments centric, not full shortlet payout lifecycle.
- `P2` PWA install UX is minimal (manifest/SW only, no explicit install UI).

## Next roadmap
### Week 1 (P0/P1)
- Execute P0-1..P0-4 in this sprint (see execution plan below).
- Add targeted regression tests for property guest path, property fallback, host inbox ordering, and host calendar data mapping.

### Week 2
- Reduce nav host badge server-load path with lightweight aggregation/caching.
- Continue shortlets search filter pushdown and parity tests.
- Add production-safe perf/diagnostic hooks for map and availability scheduler.

### Week 3–4
- Harden trust/payout operations UX (host payout timeline, stronger trust explanations).
- Expand offline/read resilience for browse surfaces.
- Add conversion-focused telemetry and CI performance budgets.

## Guard rails & CI
- Required pre-push checks: `npm --prefix web run lint`, `npm --prefix web test`, `npm --prefix web run build`.
- Existing guards:
  - `/Users/olubusayoadewale/rentnow/web/scripts/guard-next-image-optimisation.mjs`
  - `/Users/olubusayoadewale/rentnow/web/scripts/guard-no-server-getsession.mjs`
- CI workflows already wired for guards:
  - `/Users/olubusayoadewale/rentnow/.github/workflows/playwright.yml`
  - `/Users/olubusayoadewale/rentnow/.github/workflows/payments-reconcile.yml`
  - `/Users/olubusayoadewale/rentnow/.github/workflows/product-updates-sync.yml`

## App readiness (PWA -> iOS/Android)
- Reusable now:
  - Domain logic in `/Users/olubusayoadewale/rentnow/web/lib/shortlet/*` (availability, pricing, status mapping).
  - API contracts under `/Users/olubusayoadewale/rentnow/web/app/api/shortlet/*` and `/Users/olubusayoadewale/rentnow/web/app/api/shortlets/search/route.ts`.
  - PWA baseline: manifest, service worker, offline page.
- Must change for native apps:
  - Native session/push/deep-link layers.
  - Native payment UX wrappers and provider SDK strategy.
  - Offline sync/storage strategy beyond service worker caching.

## P0 Execution Plan (this sprint)
1. `fix(auth): make property detail guest-safe (no auth noise)`
- Files: `/Users/olubusayoadewale/rentnow/web/app/properties/[id]/page.tsx`, `/Users/olubusayoadewale/rentnow/web/lib/auth.ts` (or optional-user helper).
- Acceptance:
  - Signed-out property detail view emits no auth/session error logs.
  - Guest rendering remains unchanged.
- Prod verification:
  - `vercel logs --environment production --since 30m --no-follow --expand --query "/properties/"`
  - `vercel logs --environment production --since 30m --no-follow --expand --query "deny:missing_user"`

2. `fix(properties): make detail fetch resilient to SITE_URL mismatch`
- Files: `/Users/olubusayoadewale/rentnow/web/app/properties/[id]/page.tsx` (+ `/Users/olubusayoadewale/rentnow/web/lib/env.ts` only if needed).
- Acceptance:
  - Property detail still loads with bad/missing site-url env using server fallback path.
  - Not-found shown only for truly unavailable listings.
- Prod verification:
  - `vercel logs --environment production --since 30m --no-follow --expand --query "Listing not found"`
  - `vercel logs --environment production --since 30m --no-follow --expand --query "/api/properties/"`

3. `feat(host): urgency-first ordering in bookings inbox`
- Files: `/Users/olubusayoadewale/rentnow/web/lib/shortlet/shortlet.server.ts`, `/Users/olubusayoadewale/rentnow/web/components/host/HostShortletBookingsPanel.tsx`.
- Acceptance:
  - Awaiting approval sorted by `respond_by ASC`, then `created_at ASC`.
  - Upcoming sorted by `check_in ASC`; past/closed sorted by newest completion/update first.
  - `pending_payment` remains excluded from awaiting approvals.
- Prod verification:
  - `vercel logs --environment production --since 30m --no-follow --expand --query "/host/bookings"`
  - Local/manual proof with seeded pending bookings + unit test evidence.

4. `feat(host): add calendar mvp for shortlet availability`
- Files: `/Users/olubusayoadewale/rentnow/web/app/host/calendar/page.tsx`, `/Users/olubusayoadewale/rentnow/web/components/host/HostCalendar.tsx`, minimal host nav entry point.
- Acceptance:
  - Host can view month with booked (read-only) and blocked ranges.
  - Host can add/remove blocks.
  - Booked dates are non-selectable.
  - Update note added under `/Users/olubusayoadewale/rentnow/web/docs/updates/`.
- Prod verification:
  - `vercel logs --environment production --since 30m --no-follow --expand --query "/host/calendar"`
  - `vercel logs --environment production --since 30m --no-follow --expand --query "/api/shortlet/blocks"`
