# Help Coverage Audit

Last updated: 2026-03-15

## Purpose

This audit maps recently shipped host/admin/operator-facing features against current Help Centre and operational documentation coverage.

Use this file to answer:

- what is already documented well enough to support real users and operators
- what is only captured in release notes
- what still needs role-specific help coverage
- what should remain contextual UI help versus full documentation

## Scope audited

The audit covers these recently shipped areas:

- host listing quality guidance
- host best-next-fix submit guidance
- host quality telemetry
- admin listing quality visibility
- admin listing quality filters, sorting, and missing-item filters
- admin analytics navigation
- host analytics report
- Explore V2 conversion report meaning and scope
- trust cue experiment interpretation
- CTA copy experiment interpretation
- migration/deployment runbook relevance for operators

## Status definitions

- `Covered`: there is a durable role help page or operator runbook that explains the shipped behavior clearly enough for real use.
- `Partial`: there is some documentation, but it is mostly release-note level, adjacent, or too broad to support the feature well.
- `Missing`: there is no meaningful durable documentation for the shipped feature beyond code or a release note.

## Coverage matrix

| Feature | Audience | Existing help/doc location | Coverage status | What needs to be added | Priority | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Host listing quality guidance | Host | [web/docs/help/landlord/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/landlord/core-workflows.md), [web/docs/help/agent/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/agent/core-workflows.md), [web/docs/updates/2026-03-11-host-listing-quality-guidance.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-11-host-listing-quality-guidance.md), [web/docs/updates/2026-03-12-host-listing-step-quality-nudges.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-12-host-listing-step-quality-nudges.md) | Partial | Add a dedicated host help section that explains completeness score, status labels, and how submit-step guidance works in the editor. | High | Keep lightweight contextual UI nudges in-product, but add a full host help article or expand landlord/agent core workflows with a specific “Improve listing quality before submit” section. |
| Host best-next-fix submit guidance | Host | [web/docs/updates/2026-03-14-host-publish-readiness-best-next-fix.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-14-host-publish-readiness-best-next-fix.md) | Partial | Document what “Best next fix” means, how fixes are prioritized, and what `Go to Basics/Details/Photos` does. | High | Contextual help should remain primary in the stepper; add a short host help section rather than a long standalone guide. |
| Host quality telemetry | Admin, operator | [web/docs/updates/2026-03-14-host-listing-quality-telemetry.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-14-host-listing-quality-telemetry.md), [web/docs/updates/2026-03-14-admin-host-quality-telemetry-visibility.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-14-admin-host-quality-telemetry-visibility.md) | Partial | Add internal/admin docs describing emitted events, the meaning of “improvement rate,” and how to interpret score delta. | Medium | No end-user help needed; add concise internal analytics documentation on the host analytics/admin side. |
| Admin listing quality visibility | Admin | [web/docs/ADMIN_LISTINGS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_LISTINGS.md), [web/docs/updates/2026-03-11-admin-listing-quality-visibility.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-11-admin-listing-quality-visibility.md) | Partial | Update the admin listings registry doc to explain quality score, status labels, and inspector quality breakdown. | High | Full internal admin docs are warranted; this is a repeat operational surface. |
| Admin listing quality filters, sorting, and missing-item filters | Admin | [web/docs/ADMIN_LISTINGS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_LISTINGS.md), [web/docs/updates/2026-03-11-admin-listing-quality-prioritisation.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-11-admin-listing-quality-prioritisation.md), [web/docs/updates/2026-03-12-admin-listing-quality-missing-item-filters.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-12-admin-listing-quality-missing-item-filters.md) | Partial | Extend the registry doc with quality status filter, quality score sort, and missing-item quick-filter semantics. | High | Full admin docs in the listings registry guide; in-app tooltip copy can stay minimal. |
| Admin analytics navigation | Admin | [web/docs/updates/2026-03-11-admin-analytics-navigation-cleanup.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-11-admin-analytics-navigation-cleanup.md), [web/docs/updates/2026-03-14-admin-host-analytics-discoverability.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-14-admin-host-analytics-discoverability.md) | Partial | Add a durable admin analytics map covering hub destinations and sibling-nav expectations. | Medium | A short admin help page or section is enough; no separate long-form runbook needed. |
| Host analytics report | Admin | [web/docs/updates/2026-03-14-admin-host-quality-telemetry-visibility.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-14-admin-host-quality-telemetry-visibility.md) | Partial | Explain what the host analytics page is for, what search does, and how to read the quality telemetry block. | Medium | Add to admin analytics help, not a standalone ops manual. |
| Explore V2 conversion report meaning and scope | Admin | [web/docs/updates/2026-03-06-admin-explore-v2-conversion-report.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-06-admin-explore-v2-conversion-report.md) | Partial | Add admin docs stating the report is micro-sheet only, what event types are included, and what is intentionally excluded. | High | Use both contextual page copy and a compact admin analytics help section. |
| Trust cue experiment interpretation | Admin | [web/docs/updates/2026-03-10-explore-v2-trust-cue-experiment.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-10-explore-v2-trust-cue-experiment.md), [web/docs/updates/2026-03-11-admin-explore-v2-trust-cue-breakdown.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-11-admin-explore-v2-trust-cue-breakdown.md), [web/docs/help/trust-signals.md](/Users/olubusayoadewale/rentnow/web/docs/help/trust-signals.md) | Partial | Document what `none`, `instant_confirmation`, and `unknown` mean, and make clear that the cue is truth-based and listing-dependent. | Medium | Keep experiment interpretation in admin analytics help; public trust-signals help should not be overloaded with experiment ops detail. |
| CTA copy experiment interpretation | Admin | [web/docs/updates/2026-03-13-explore-v2-cta-copy-experiment.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-13-explore-v2-cta-copy-experiment.md), [web/docs/updates/2026-03-13-admin-explore-v2-cta-copy-breakdown.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-13-admin-explore-v2-cta-copy-breakdown.md) | Partial | Add variant meaning, intent-aware label rules, and guidance on how to read `default`, `clarity`, `action`, and `unknown`. | Medium | Admin analytics help only; no user-facing article needed. |
| Migration/deployment runbook relevance for operators | Operator, admin | [docs/go-live-checklist.md](/Users/olubusayoadewale/rentnow/docs/go-live-checklist.md), [web/docs/ops/supabase-migrations.md](/Users/olubusayoadewale/rentnow/web/docs/ops/supabase-migrations.md), [web/docs/updates/2026-03-13-supabase-migration-guardrails.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-13-supabase-migration-guardrails.md) | Covered | Keep runbooks current as migration workflow evolves; no immediate gap. | Medium | Full runbook is correct here; no contextual help needed. |

## Key findings

### 1. Release notes are ahead of Help Centre coverage

Recent host/admin features are well represented in `web/docs/updates/**`, but that is not enough for durable operational help. The biggest gap is that role-based Help Centre pages still describe older generic workflows instead of the specific March listing-quality and analytics additions.

### 2. Admin listings operations docs are lagging the shipped registry

[web/docs/ADMIN_LISTINGS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_LISTINGS.md) is the closest durable doc for admin listing-quality features, but it still describes pre-quality filters and older missing-field filters. It should be the first place updated because it is already the right operational surface.

### 3. Admin analytics needs one compact internal help surface

There is now enough analytics surface area that release notes alone are not sufficient:

- Marketplace analytics
- Explore analytics
- Explore V2 conversion
- Host analytics

The repo needs one compact admin analytics help page or section that explains destination purpose, report scope, and experiment interpretation.

### 4. Host quality guidance needs one clear host-facing explanation

Hosts now have:

- submit-step completeness guidance
- step-specific nudges
- best-next-fix prioritization
- jump-back actions

But the current landlord/agent help pages still talk about quality in broad terms only. Hosts need a route-accurate explanation of how the stepper guidance works.

## Gap list by priority

### High priority

- Update [web/docs/ADMIN_LISTINGS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_LISTINGS.md) with:
  - quality score/status meaning
  - registry quality filters/sorting
  - missing-item quick filters
  - inspector quality breakdown
- Add host help coverage for:
  - completeness score
  - step-specific nudges
  - submit-step best-next-fix and jump-back actions
- Add admin analytics help coverage for Explore V2 conversion report scope:
  - micro-sheet only
  - included events
  - excluded rail-level actions

### Medium priority

- Add admin analytics help coverage for:
  - host analytics destination purpose
  - host quality telemetry interpretation
  - trust cue experiment interpretation
  - CTA copy experiment interpretation
- Update admin getting-started or ops docs to point admins to `/admin/analytics` as the canonical analytics hub.

### Low priority

- Consider a short cross-link from host success/core workflow pages to listing quality guidance.
- Add a small “where to find analytics” note in admin help pages to reinforce IA consistency.

## Sustainable process recommendation

The current process already says help updates are part of Definition of Done, but it is not strict enough in practice. The sustainable approach is:

1. Keep release notes for every shipped feature.
2. Require one additional decision for every host/admin feature batch:
   - update a role help page
   - update an internal ops doc
   - or explicitly justify why contextual UI help is sufficient
3. Prefer updating an existing durable doc over creating a new one unless a new surface truly needs its own page.
4. Treat experiment reporting as admin documentation work, not only analytics work.
5. When a feature changes a repeat workflow, update the durable workflow doc in the same batch.

## Recommended doc ownership pattern

- `web/docs/help/**`
  - Role-facing task help for hosts, tenants, agents, and admins.
- `web/docs/ADMIN_*.md` and `web/docs/ops/**`
  - Internal/operator documentation for repeat operational work.
- `web/docs/updates/**`
  - Release notes only; useful history, not the main support surface.
- `docs/product/**`
  - Canonical planning/audit documents like this one and the living roadmap.

## Docs update checklist for future feature batches

Use this checklist in future host/admin batches:

- Did the feature change a repeat workflow for a real user or operator?
- Which durable doc should be updated:
  - role help page
  - admin/internal ops doc
  - operator runbook
- Is a release note already in `web/docs/updates/**`?
- Is contextual in-product help enough, or does the surface now need a durable doc?
- Does the feature introduce new filters, scores, statuses, variants, or telemetry terms that need definition?
- Does the feature change the meaning or scope of an existing report?
- Does the feature require a migration/runbook or operator deployment note?
- Was `web/docs/help/_no-help-change.md` used only when the omission is genuinely justified?

## Recommended next doc batches

1. Admin listings docs pass
   - Update [web/docs/ADMIN_LISTINGS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_LISTINGS.md) for quality signals, filters, sorting, and missing-item filters.
2. Host listing quality help pass
   - Expand [web/docs/help/landlord/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/landlord/core-workflows.md) and [web/docs/help/agent/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/agent/core-workflows.md) with route-accurate quality-guidance guidance.
3. Admin analytics help pass
   - Add a compact admin analytics help doc covering hub destinations, Explore V2 report scope, host analytics, and experiment interpretation.
