# Help Coverage Audit

Last updated: 2026-03-16

## Purpose

This audit tracks whether durable Help and internal docs reflect the currently shipped product.

Use it to answer:

- what is fully documented already
- what is role-specific versus operator-only
- where discoverability, permissions, and route behaviour are now documented
- what should still be treated as release-note history only

## Scope audited

This pass covers the current shipped host/admin/request/ops work, including:

- Property Requests access, workflows, responder alerts, admin moderation, and request analytics
- Explore V2 conversion reporting and active experiment interpretation
- host listing quality guidance, best-next-fix behaviour, and host quality telemetry
- admin listing quality operations
- admin analytics navigation and discoverability
- admin review email notifications
- image optimisation mode control
- migration/deployment runbook relevance for operators

## Status definitions

- `Covered`: durable help or internal docs explain the shipped behaviour clearly enough for real use.
- `Partial`: some durable guidance exists, but a real operator or user would still need release notes or code context.
- `Missing`: no meaningful durable documentation exists beyond a release note or code.

## Coverage matrix

| Feature | Audience | Existing help/doc location | Coverage status | What needs to be added | Priority | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Property Requests seeker workflows | Tenant | [web/docs/help/tenant/property-requests.md](/Users/olubusayoadewale/rentnow/web/docs/help/tenant/property-requests.md), [web/docs/help/tenant/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/tenant/core-workflows.md), [web/docs/help/tenant/getting-started.md](/Users/olubusayoadewale/rentnow/web/docs/help/tenant/getting-started.md) | Covered | Keep route references current if seeker entry points change. | Medium | Role help is the right durable surface. |
| Property Requests responder workflows | Host, agent, landlord | [web/docs/help/landlord/property-requests.md](/Users/olubusayoadewale/rentnow/web/docs/help/landlord/property-requests.md), [web/docs/help/agent/property-requests.md](/Users/olubusayoadewale/rentnow/web/docs/help/agent/property-requests.md), [web/docs/help/landlord/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/landlord/core-workflows.md), [web/docs/help/agent/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/agent/core-workflows.md) | Covered | Keep responder constraints aligned with future matching workflow changes. | Medium | Role help plus workflow summaries is sufficient. |
| Property Requests admin moderation and analytics | Admin | [web/docs/help/admin/property-requests.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/property-requests.md), [web/docs/help/admin/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/core-workflows.md), [web/docs/help/admin/ops.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/ops.md), [web/docs/ADMIN_OPS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_OPS.md) | Covered | None beyond routine maintenance. | High | Internal admin docs are the correct long-lived surface. |
| Property Requests responder alerting | Host, agent, landlord, admin | [web/docs/help/landlord/property-requests.md](/Users/olubusayoadewale/rentnow/web/docs/help/landlord/property-requests.md), [web/docs/help/agent/property-requests.md](/Users/olubusayoadewale/rentnow/web/docs/help/agent/property-requests.md), [web/docs/help/landlord/getting-started.md](/Users/olubusayoadewale/rentnow/web/docs/help/landlord/getting-started.md), [web/docs/help/agent/getting-started.md](/Users/olubusayoadewale/rentnow/web/docs/help/agent/getting-started.md), [web/docs/help/admin/property-requests.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/property-requests.md) | Covered | Keep targeting rules updated if relevance logic changes. | Medium | Role help is enough; no separate notification manual needed. |
| Explore V2 conversion report meaning and scope | Admin | [web/docs/help/admin/analytics.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/analytics.md), [web/app/admin/analytics/explore-v2/page.tsx](/Users/olubusayoadewale/rentnow/web/app/admin/analytics/explore-v2/page.tsx) | Covered | None beyond scope changes. | High | Admin analytics help is the right place. |
| Trust cue experiment interpretation | Admin | [web/docs/help/admin/analytics.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/analytics.md), [web/docs/help/trust-signals.md](/Users/olubusayoadewale/rentnow/web/docs/help/trust-signals.md) | Covered | Keep variant names aligned if the experiment closes or changes. | Medium | Split public trust-signal meaning from admin experiment ops guidance. |
| CTA copy experiment interpretation | Admin | [web/docs/help/admin/analytics.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/analytics.md) | Covered | Keep variant semantics aligned if labels change. | Medium | Admin analytics help is sufficient. |
| Host listing quality guidance | Host, agent, landlord | [web/docs/help/landlord/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/landlord/core-workflows.md), [web/docs/help/agent/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/agent/core-workflows.md) | Covered | Keep step labels aligned if the editor flow changes. | High | Workflow docs plus in-product cues are the right mix. |
| Host best-next-fix submit guidance | Host, agent, landlord | [web/docs/help/landlord/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/landlord/core-workflows.md), [web/docs/help/agent/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/agent/core-workflows.md) | Covered | None beyond future stepper changes. | High | No extra standalone article needed. |
| Host quality telemetry and admin interpretation | Admin | [web/docs/help/admin/analytics.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/analytics.md), [web/docs/help/admin/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/core-workflows.md) | Covered | None beyond metric contract changes. | Medium | Keep it in admin analytics docs, not public help. |
| Admin listing quality visibility, filtering, sorting, and inspector use | Admin | [web/docs/ADMIN_LISTINGS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_LISTINGS.md), [web/docs/help/admin/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/core-workflows.md) | Covered | Keep labels aligned with UI if filter names change. | High | Internal admin doc is the right durable source. |
| Admin analytics navigation and discoverability | Admin | [web/docs/help/admin/getting-started.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/getting-started.md), [web/docs/help/admin/analytics.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/analytics.md) | Covered | None beyond IA changes. | Medium | Hub-plus-sibling-nav guidance is enough. |
| Admin listing review email notifications | Admin | [web/docs/ADMIN_OPS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_OPS.md), [web/docs/help/admin/core-workflows.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/core-workflows.md), [web/docs/help/admin/ops.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/ops.md) | Covered | Keep `/profile` wording aligned with the actual toggle label. | Medium | Internal ops docs are sufficient. |
| Image optimisation mode control | Admin, operator | [web/docs/ADMIN_OPS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_OPS.md), [web/docs/help/admin/ops.md](/Users/olubusayoadewale/rentnow/web/docs/help/admin/ops.md) | Covered | Keep mode descriptions aligned with shared image wrapper behaviour. | Medium | Internal ops docs are the correct surface. |
| Migration/deployment runbook relevance for operators | Operator, admin | [docs/go-live-checklist.md](/Users/olubusayoadewale/rentnow/docs/go-live-checklist.md), [web/docs/ops/supabase-migrations.md](/Users/olubusayoadewale/rentnow/web/docs/ops/supabase-migrations.md) | Covered | Keep exact CLI commands current. | Medium | Full runbook remains correct. |

## Audit conclusion

Current high-priority host/admin/request features now have durable documentation coverage.

Most earlier gaps are now closed:

- Property Requests is role-documented for tenant, responder, and admin flows.
- Admin analytics now has a durable interpretation guide instead of relying on release notes.
- Host listing quality behaviour is documented as an editor workflow, not only as a release note.
- Admin listing quality operations are documented as registry and inspector workflows.
- Admin notification controls and image optimisation ops controls are documented as operator actions.

## Remaining caution areas

These are not current coverage gaps, but they require upkeep whenever the product changes:

- Explore V2 experiment buckets and scope copy must stay aligned with the report contract.
- Host listing quality docs must be updated if step labels or fix prioritisation logic changes.
- Property Requests help must be updated if chat, digests, or broader responder targeting is added later.
- Admin ops docs must be updated whenever control-panel shortcuts or settings labels move.

## Sustainable process recommendation

For future batches:

1. Ship the release note in `web/docs/updates/**`.
2. Update the durable role or operator doc in the same batch.
3. If the feature changes:
   - a route
   - a workflow
   - a status
   - a filter
   - a metric
   - a toggle
   then the durable docs are part of Definition of Done.
4. Use `_no-help-change.md` only when the omission is genuinely defensible.
5. Re-run this audit when a new product lane appears, not on every minor copy tweak.

## Docs update checklist for future batches

- Which audience changed:
  - tenant
  - host / landlord / agent
  - admin
  - operator
- Which route or entry point changed?
- Did discoverability or navigation change?
- Did permissions or privacy boundaries change?
- Did a new metric, filter, status, or experiment bucket appear?
- Does the change belong in:
  - role help
  - internal admin doc
  - operator runbook
- Is the release note present?
- Are durable docs now clearer than the release note history?
