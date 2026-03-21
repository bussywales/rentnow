# Docs & Help Drift Agent v1

## Purpose

Docs & Help Drift Agent v1 is the first live PropatyHub Codex automation.

Its job is to detect likely drift between shipped product or admin changes and the durable docs/help surfaces that operators, admins, and future Codex sessions are expected to trust.

V1 is intentionally review-queue based.

It does not merge changes, rewrite product behavior, or make autonomous documentation claims about ambiguous behavior.

## Why this agent goes first

This agent is the safest first automation because it is:

- high value
- low operational risk
- grounded in repo truth
- easy for a human to review quickly
- a good proving ground for evidence-first automation discipline

This document should be used with:

- [CODEX_AUTOMATION_ARCHITECTURE.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_ARCHITECTURE.md)
- [CODEX_AUTOMATION_OPERATING_SUMMARY.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_OPERATING_SUMMARY.md)
- [CODEX_AUTOMATION_ROLLOUT_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_ROLLOUT_PLAN.md)
- [HELP_COVERAGE_AUDIT.md](/Users/olubusayoadewale/rentnow/docs/product/HELP_COVERAGE_AUDIT.md)
- [ROADMAP.md](/Users/olubusayoadewale/rentnow/docs/product/ROADMAP.md)
- [CODEX_RULES.md](/Users/olubusayoadewale/rentnow/docs/CODEX_RULES.md)
- [ADMIN_OPS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_OPS.md)
- [ADMIN_LISTINGS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_LISTINGS.md)
- [DOCS_HELP_DRIFT_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/DOCS_HELP_DRIFT_REPORT_TEMPLATE.md)

## Operating model

### Schedule

Default cadence:

- every weekday at 14:00 Europe/London time

Extra triggered runs are recommended after merges that touch any of:

- `web/app/admin/**`
- `web/app/api/admin/**`
- `web/components/admin/**`
- `web/lib/admin/**`
- `web/app/host/**`
- `web/app/dashboard/**`
- `web/app/properties/**`
- `web/app/requests/**`
- `web/app/shortlets/**`
- `web/components/properties/**`
- `web/components/host/**`
- `web/components/leads/**`
- `web/docs/help/**`
- `web/docs/ADMIN_OPS.md`
- `web/docs/ADMIN_LISTINGS.md`
- `docs/product/**`

### Scope in v1

In scope for drift detection:

- role help under `web/docs/help/**`
- internal admin/operator docs under `web/docs/**`
- canonical product and operations docs under `docs/product/**`
- shipped update notes under `web/docs/updates/**` as change-history input

Out of scope for autonomous action:

- product code
- API logic
- entitlement logic
- payment readiness claims
- schema changes
- destructive admin behavior
- legal or policy statements

## Inputs

Each run should read:

- recent merged diffs or changed-file lists
- recent update notes under `web/docs/updates/**`
- [HELP_COVERAGE_AUDIT.md](/Users/olubusayoadewale/rentnow/docs/product/HELP_COVERAGE_AUDIT.md)
- role help under `web/docs/help/**`
- internal admin/operator docs, especially:
  - [ADMIN_OPS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_OPS.md)
  - [ADMIN_LISTINGS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_LISTINGS.md)
- roadmap and operating constraints from [ROADMAP.md](/Users/olubusayoadewale/rentnow/docs/product/ROADMAP.md)
- release-note discipline from [CODEX_RULES.md](/Users/olubusayoadewale/rentnow/docs/CODEX_RULES.md)

## What should trigger likely drift

V1 should treat these change types as drift candidates:

- route or entry-point changes
- workflow changes
- status or label changes
- filter changes
- metric/report meaning changes
- toggle or setting changes
- permissions or visibility changes
- admin inspection or moderation changes
- host or tenant discoverability changes
- any user-visible or admin-visible change that ships with an update note but no durable doc change

High-sensitivity change families:

- admin listings and moderation
- admin analytics and ops
- payments and billing docs
- shortlets behavior and runbooks
- saved/search/request workflows

## Outputs

Each run should produce one daily review artifact using the template in [DOCS_HELP_DRIFT_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/DOCS_HELP_DRIFT_REPORT_TEMPLATE.md).

Required sections:

- run scope
- changed files reviewed
- likely drift findings
- severity and audience
- recommended target docs
- whether patch drafting is safe
- explicit review status

Permitted outputs in v1:

- drift report
- recommended patch targets
- draft patch text for clearly docs-only corrections

V1 should not create autonomous PRs.

## Severity model

Use this severity model in every report:

- `S1 Critical`
  - durable docs actively contradict shipped behavior in a way that could mislead operators, admins, or users
- `S2 High`
  - user-facing or admin-facing behavior changed, but durable docs or help were not updated
- `S3 Medium`
  - docs exist but labels, routes, filters, status names, or step wording have drifted
- `S4 Low`
  - polish, wording, cross-linking, or update-note follow-through issue

Audience tags:

- `ADMIN`
- `HOST`
- `TENANT`
- `AGENT`
- `OPERATOR`
- `SHARED`

## Review rules

Every run must classify its output as one of:

1. `report only`
2. `review required`
3. `blocked pending approval`

### Auto-allowed in v1

These may be drafted automatically when repo truth is clear:

- docs-only wording fixes
- route/label/status updates in existing help docs
- missing cross-links between durable docs
- update-note reminders
- refreshes to coverage-audit notes when scope is obvious

### Review-required in v1

These must stop in the review queue:

- any change that would alter product meaning rather than document it
- any change touching payment readiness, launch status, or monetisation claims
- any change that implies a policy decision
- any change that requires code truth not clearly present in the diff or docs
- any help rewrite that changes operational guidance substantially

### Never autonomous

The agent must never:

- merge directly to `main`
- change product or admin code
- alter schema or migrations
- change payment cutover/readiness claims without human review
- change legal, pricing, or entitlement statements
- delete or rewrite major help sections without human review

## Allowed-touch boundary

The agent may touch only:

- `docs/product/**`
- `web/docs/**`
- `web/docs/help/**`
- `web/docs/updates/**`

It must not patch unrelated code even if the drift was caused by code.

## Daily report format

Use one report per run with this structure:

1. `Run metadata`
2. `Files reviewed`
3. `Likely drift findings`
4. `Patch targets`
5. `Draftable now`
6. `Review-required items`
7. `Blocked items`
8. `Recommended next docs batch`

The exact template lives in [DOCS_HELP_DRIFT_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/DOCS_HELP_DRIFT_REPORT_TEMPLATE.md).

## Recommended operator workflow

Daily operator loop:

1. Review the report.
2. Confirm whether each flagged product/admin change is real drift or acceptable no-doc change.
3. Split findings into:
   - docs-only patch now
   - review-required docs clarification
   - no-action justified
4. If a docs-only patch is safe, land it as a separate narrow batch.
5. If the finding implies product ambiguity, open a review batch instead of guessing.

## How to turn a report into a safe docs patch batch

Use this decision rule:

- patch immediately when:
  - route, label, status, filter, or help wording drift is obvious from repo truth
- stop for review when:
  - behavior, entitlement, payment readiness, or operator meaning is uncertain

Safe patch batch output should contain:

- exact files to update
- evidence from changed product/admin surfaces
- update note status
- audience impact
- rollback instruction

## v1 success criteria

Docs & Help Drift Agent v1 is working if it:

- catches likely durable-doc drift within one working day
- produces evidence-based reports instead of vague reminders
- reduces reliance on update-note history alone
- gives future chats a clean, reviewable source for doc maintenance
- never crosses its review boundary

## What v1 does not try to solve

V1 does not:

- maintain multiple agents
- auto-merge docs
- rewrite help content speculatively
- resolve product ambiguity by itself
- replace product owners or admin operators

That restraint is deliberate.

