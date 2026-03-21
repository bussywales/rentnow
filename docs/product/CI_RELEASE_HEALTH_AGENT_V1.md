# CI & Release Health Agent v1

## Purpose

CI & Release Health Agent v1 is the second live PropatyHub Codex automation.

Its job is to review recent workflow failures, release-gate outcomes, and recent shipped changes so the team gets one concise daily engineering-health brief instead of relying on scattered GitHub views and memory.

V1 is intentionally review-queue based.

It does not rerun jobs, dismiss failures, merge fixes, or change product code autonomously.

## Why this agent is the second rollout

This agent comes after Docs & Help Drift Agent because it is still bounded and low-risk, but it operates closer to release decisions.

It is useful when:

- a workflow is red but the real failure cluster is unclear
- the same surface is failing repeatedly and may be flaky
- release owners need to know whether a red run is blocking shipment
- recent shipped changes may have created new operator risk

This document should be used with:

- [CODEX_AUTOMATION_ARCHITECTURE.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_ARCHITECTURE.md)
- [CODEX_AUTOMATION_OPERATING_SUMMARY.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_OPERATING_SUMMARY.md)
- [CODEX_AUTOMATION_ROLLOUT_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_ROLLOUT_PLAN.md)
- [ROADMAP.md](/Users/olubusayoadewale/rentnow/docs/product/ROADMAP.md)
- [CI_RELEASE_HEALTH_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/CI_RELEASE_HEALTH_REPORT_TEMPLATE.md)
- [go-live-checklist.md](/Users/olubusayoadewale/rentnow/web/docs/go-live-checklist.md)
- [PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md)

## Operating model

### Schedule

Default cadence:

- every weekday at 09:00 Europe/London time

Recommended extra runs:

- after merges to `main`
- before a planned go-live or payments cutover window
- after a repeated red CI day where the same lane fails twice or more

## Scope in v1

In scope for daily health review:

- GitHub Actions workflow failures
- release-gate outcomes
- repeated flaky or unstable smoke results
- migration-guard failures
- payments reconcile workflow failures
- recent shipped update notes that operators should know about

Primary workflow/run types in scope:

- [/.github/workflows/playwright.yml](/Users/olubusayoadewale/rentnow/.github/workflows/playwright.yml)
- [/.github/workflows/payments-reconcile.yml](/Users/olubusayoadewale/rentnow/.github/workflows/payments-reconcile.yml)
- [/.github/workflows/supabase-migrations.yml](/Users/olubusayoadewale/rentnow/.github/workflows/supabase-migrations.yml)
- [/.github/workflows/product-updates-sync.yml](/Users/olubusayoadewale/rentnow/.github/workflows/product-updates-sync.yml)
- [/.github/workflows/property-request-reminders.yml](/Users/olubusayoadewale/rentnow/.github/workflows/property-request-reminders.yml)
- [/.github/workflows/shortlet-reminders.yml](/Users/olubusayoadewale/rentnow/.github/workflows/shortlet-reminders.yml)
- [/.github/workflows/fx-daily-rates.yml](/Users/olubusayoadewale/rentnow/.github/workflows/fx-daily-rates.yml)
- [/.github/workflows/support-autoclose.yml](/Users/olubusayoadewale/rentnow/.github/workflows/support-autoclose.yml)

Release-gate surfaces in scope:

- `npm --prefix web run test:e2e:golive`
- `npm --prefix web run build`
- `npm --prefix web test`
- `npm --prefix web run db:migrations:status`

Out of scope for autonomous action:

- product code changes
- schema changes
- workflow policy changes
- release threshold changes
- payment readiness claims
- live cutover decisions

## Inputs

Each run should read:

- recent failed workflow runs since the previous successful run
- latest go-live run status
- recent merged change summaries or changed-file lists
- recent update notes under `web/docs/updates/**`
- known ops and release docs, especially:
  - [go-live-checklist.md](/Users/olubusayoadewale/rentnow/web/docs/go-live-checklist.md)
  - [2026-03-21-golive-baseline-stabilisation.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-21-golive-baseline-stabilisation.md)
  - [2026-03-21-shortlets-mobile-react418-fix.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-21-shortlets-mobile-react418-fix.md)
  - [2026-03-19-payments-reconcile-workflow-hardening.md](/Users/olubusayoadewale/rentnow/web/docs/updates/2026-03-19-payments-reconcile-workflow-hardening.md)

## Classification model

Every important failure should be classified as one primary type:

- `real regression`
  - the app, workflow, or release contract is actually broken
- `flaky`
  - the failure is inconsistent and likely due to timing, nondeterminism, or test harness sensitivity
- `infra/config`
  - secrets, environment, provider, runner, network, or external config caused the failure
- `release-gate blocker`
  - this failure currently blocks safe shipment, regardless of root cause

Failures may carry one primary class plus one extra note if needed.

Example:

- primary class: `real regression`
- extra note: `release-gate blocker`

### Severity model

Use this severity model in every report:

- `S1 Critical`
  - active release blocker, repeated red run, or broken launch-critical lane
- `S2 High`
  - important regression or repeated gate instability that should be handled quickly
- `S3 Medium`
  - non-blocking failure or one-off workflow issue worth review
- `S4 Low`
  - noise, cleanup item, or minor instability not currently blocking shipment

## Time-window rule

Default review window:

- only failures, red runs, and shipped changes since the previous successful run

Use a broader backfill only when explicitly requested.

## Evidence rule

Use the 2 to 4 most relevant references per finding.

Preferred evidence:

- workflow file
- failing job/step name
- update note for the relevant shipped change
- route, config, or test file directly tied to the failure

Do not overload the report with low-signal references.

## Outputs

Each run should produce one daily review artifact using [CI_RELEASE_HEALTH_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/CI_RELEASE_HEALTH_REPORT_TEMPLATE.md).

Required outputs in v1:

- daily CI and release health report
- release-blocker list
- likely owner area or patch target per important failure
- short shipped-changes awareness section

Permitted additional output in v1:

- suggested stabilization batch title
- suggested docs/update-note patch target
- suggested workflow diagnostics patch target

V1 should not create autonomous PRs.

## Review rules

Every run must classify its output as one of:

1. `report only`
2. `review required`
3. `blocked pending approval`

### Auto-allowed in v1

These may be suggested safely:

- daily reports
- failure classification
- likely owner areas
- workflow diagnostics patch targets
- documentation/update-note follow-up suggestions

### Review-required in v1

These must stop in the review queue:

- any change to workflow policy or release thresholds
- any test stabilization that may hide a real app defect
- any product-runtime fix
- any change to payment readiness interpretation
- any migration or shared-environment action

### Never autonomous

The agent must never:

- merge directly to `main`
- rerun or dismiss CI failures as policy
- alter workflow logic or gate thresholds autonomously
- change app code
- change schemas or push migrations
- change payment cutover or release readiness claims without human review

## Allowed-touch boundary

The agent may touch only:

- `docs/product/**`
- `web/docs/**`
- optionally `.github/workflows/**` only for diagnostics-oriented patch suggestions after review

V1 should default to report generation, not workflow edits.

## Daily report format

Use one report per run with this structure:

1. `Summary`
2. `Health snapshot`
3. `Failing runs`
4. `Classification`
5. `Likely affected area`
6. `Recommended next action`
7. `Recently shipped changes worth operator awareness`
8. `Optional patch or stabilisation targets`

The exact template lives in [CI_RELEASE_HEALTH_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/CI_RELEASE_HEALTH_REPORT_TEMPLATE.md).

## Recommended operator workflow

Daily operator loop:

1. Review the summary and health snapshot first.
2. Triage `S1` and `S2` findings before lower-severity items.
3. Separate findings into:
   - real regression to investigate
   - flaky failure to monitor or stabilize
   - infra/config issue to resolve operationally
   - release blocker that pauses shipment
4. If a fix is obvious and low-risk, open a narrow stabilization batch.
5. If a failure is ambiguous, request a focused audit batch instead of guessing.

## How to turn a report into a safe stabilization batch

Use this decision rule:

- open a stabilization batch when:
  - the failing surface is concrete
  - the likely root-cause family is narrow
  - a fix can be validated without bundling unrelated work
- stop for review when:
  - the failure may reflect product behavior rather than harness instability
  - the proposed fix would change release policy, workflow behavior, or payment meaning

Safe follow-up batch output should contain:

- failing run or spec name
- classification and severity
- likely affected surface
- evidence references
- narrow fix scope
- rollback instruction

## v1 success criteria

CI & Release Health Agent v1 is working if it:

- makes red workflow days understandable quickly
- separates flaky from likely real regressions with evidence
- highlights actual release blockers without over-reporting noise
- gives operators visibility into recent shipped changes that matter for release health
- never crosses its review boundary

## What v1 does not try to solve

V1 does not:

- auto-fix tests or workflows
- auto-rerun jobs
- decide release go/no-go by itself
- replace human triage for risky failures
- rewrite release policy

That restraint is deliberate.

