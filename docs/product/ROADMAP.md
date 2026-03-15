# PropatyHub Product + Engineering Roadmap

Last updated: 2026-03-15

This is the canonical roadmap for current product direction, engineering priorities, operating rules, and known fragility. Use this file as the source of truth for future planning. Older roadmap files should be treated as historical context unless they explicitly point back here.

## 1. Current platform state

PropatyHub is now operating as a multi-surface property marketplace with four active operating lanes:

- Tenant discovery and saved/search flows across home, explore, explore-v2, properties, collections, and shortlets.
- Host listing creation, edit, submit, shortlet operations, and listing quality guidance.
- Admin operations across listings, review, support, analytics, referrals, shortlets ops, and settings.
- Shared platform foundations for analytics, experiments, product updates, help content, and Supabase-backed operational workflows.

Current platform characteristics:

- Admin, host, and tenant surfaces are all live and actively changing.
- Explore V2 is live with experiment hooks, conversion telemetry, and admin reporting.
- Shortlets is live but historically more fragile than core browse routes.
- Listing quality is now a shared system used across host and admin workflows.
- Schema-backed feature work is common; Supabase migration discipline is now part of the release contract.

## 2. Recently shipped capabilities

Recent shipped work, reflected in `main` and update notes:

- Admin analytics IA cleanup, including discoverable analytics destinations and host analytics visibility.
- Admin listing quality visibility, prioritisation, and missing-item filters in the listings registry and inspector.
- Host listing quality guidance in the editor, including step-specific nudges, submit-step best-next-fix guidance, and telemetry.
- Host listing quality telemetry reporting inside admin host analytics.
- Explore V2 trust-cue and CTA copy experiments, plus analytics/reporting support for those variants.
- Explore V2 analytics role/consent parity and report-scope clarity.
- Explore V2 analytics contract repair, including Supabase constraint alignment for Explore V2 event names.
- PWA and startup-path work, including shortlets hydration hardening, explore-labs test stability, and migration deployment guardrails.
- Admin UX cleanup for demo-listing feature controls and analytics discoverability.

## 3. Immediate priorities

These are the next high-value priorities based on current shipped work and known risk:

- Keep Explore V2 experiment reporting accurate and readable while trust-cue and CTA-copy variants are live.
- Tighten host listing quality measurement so the team can decide which nudges materially improve listing completeness before submit.
- Continue admin ops polish where it improves speed without widening scope: listing triage, analytics readability, and quality follow-up actions.
- Maintain release stability on historically brittle routes before expanding product surface area further.
- Keep update-note, help, and admin/operator documentation in sync with every user-facing or admin-facing feature batch.

## 4. Next priorities

- Turn host listing quality telemetry into concrete iteration decisions for copy, ranking of fixes, and step guidance.
- Expand admin analytics usefulness with compact internal readouts, not dashboard sprawl.
- Improve marketplace quality consistency across titles, cover media, images, and host guidance rather than relying on late-stage admin cleanup.
- Continue shortlets performance and stability work only where it reduces known regressions or release risk.
- Keep monetisation and featured-placement work operationally safe, with admin tooling and analytics clarity ahead of heavier commercial logic.

## 5. Deferred / not-now items

Not current priorities unless a separate batch explicitly promotes them:

- Broad redesigns of Explore V2 conversion surfaces while experiments are active.
- Large dashboard or BI-style analytics rebuilds.
- Multi-route anonymous HTML caching beyond the routes explicitly audited as safe.
- Broad service-worker expansion without route-by-route safety review.
- Heavy publish-blocking rules for listing quality; current posture is guidance first.
- Large refactors of shortlets/search architecture without a concrete defect or measurable win.
- Subscription/performance-pricing expansion not grounded in current operational readiness.

## 6. Active experiments

These are live or recently shipped experiment surfaces that should be treated carefully:

- Explore V2 trust cue experiment
  - Flag/setting controlled.
  - Must remain truthful and data-backed.
  - Admin report includes trust-cue variant breakdown.
- Explore V2 CTA copy experiment
  - Variant controlled through settings.
  - Must remain intent-aware and truthful to the underlying action.
  - Admin report includes CTA copy variant breakdown.
- Host listing quality guidance iteration
  - Not a classic A/B test yet, but telemetry is now live.
  - Treat guidance copy, ranking, and jump-back actions as measurable product behavior, not casual copy edits.

## 7. Marketplace quality roadmap

Current direction:

- Keep the shared listing quality system as the contract for completeness, hero media resolution, and meaningful-title checks.
- Improve listing quality upstream in the host flow before admin intervention is needed.
- Use admin registry and inspector surfaces to find weak listings quickly.
- Use host telemetry to learn which missing items are most common and which fixes actually improve quality before submit.

Near-term roadmap:

- Refine fix prioritisation based on telemetry, not opinion.
- Keep public listing presentation consistent across cards, detail pages, and admin review surfaces.
- Add only lightweight, truthful quality signals. Do not invent trust.
- Avoid turning quality guidance into punitive blocking unless the business rule is explicit and the UX is ready.

## 8. Admin operations roadmap

Current direction:

- Keep admin control-panel IA clear and shallow.
- Prefer one discoverable analytics hub with clean second-level destinations over scattered admin entry points.
- Make admin listing workflows operational: registry triage, inspector context, review actions, and telemetry visibility.
- Keep support, shortlets ops, and analytics pages stable under go-live smoke coverage.

Near-term roadmap:

- Continue compact improvements to admin analytics readability.
- Expand admin listing ops only when the next action becomes materially faster or safer.
- Prefer shared nav/components/contracts over page-by-page divergence.
- Avoid adding top-level admin clutter when the same goal can be solved inside existing hubs.

## 9. Stability / ops guardrails

- No push without double-green go-live.
- Schema-backed features require a remote Supabase migration push, not just a local migration file.
- Run `npm --prefix web run db:migrations:status` before shipping schema-backed changes.
- If migrations are pending, stop and run `cd web && npx supabase@latest db push --include-all`.
- Keep update notes current for shipped work; repo tests enforce frontmatter and audience rules.
- User-facing and admin-facing features should consider help coverage and operator docs as part of the batch, not as optional cleanup.
- Prefer minimal scoped fixes for unstable routes and tests. Do not hide real regressions behind weak assertions.

## 10. Known fragile areas

- Shortlets routes
  - Historical hydration/runtime fragility, especially on mobile and map-driven flows.
  - Test timing around bbox/map sync has broken before.
- Explore Labs
  - Page-load assertions have been sensitive to brittle wait conditions.
- Explore V2 analytics/reporting
  - Schema, API allowlists, and report aggregation must stay aligned.
  - Do not assume new analytics fields are safe until storage and reporting paths are verified.
- PWA/service-worker/startup behavior
  - Safe only when route personalization and cache scope are audited explicitly.
- Admin analytics/report pages
  - Easy to fragment if nav labels, cards, and section links are edited independently.

## 11. Working rules for future changes

- No push without two back-to-back green `test:e2e:golive` runs.
- Schema-backed features require remote Supabase migration deployment before considering the batch truly shipped.
- Do not casually change Explore V2 conversion surfaces while experiments are live.
- Keep Explore V2 analytics semantics stable; if scope changes, update the report copy and event contract deliberately.
- Shortlets routes have historical hydration/test fragility; treat them as high-sensitivity surfaces.
- Preserve SSR-visible UI contracts when optimizing performance or deferring data.
- Prefer shared helpers and shared view models over duplicated threshold logic, filter logic, or experiment logic.
- Do not remove kill switches or experiment flags unless the owning experiment is explicitly closed.
- For any user-facing or admin-facing feature:
  - add or update the product update note
  - consider help/runbook/admin docs coverage
  - keep tests aligned with the visible contract
- If go-live fails on a clean baseline, stop and stabilize the baseline before forcing unrelated feature work through.

## 12. How to use this roadmap in future Codex sessions

- Read this file before planning any new batch.
- Treat this file as the planning baseline and the recent chat history as secondary context.
- When proposing a batch:
  - confirm it fits an immediate or next priority here
  - call out if it touches a known fragile area
  - state whether migrations, experiments, help docs, or update notes are required
- When a batch changes priorities materially, update this file in the same batch rather than leaving roadmap drift behind.
- If a legacy roadmap file disagrees with this one, treat this document as canonical and update the legacy file to point here if needed.
