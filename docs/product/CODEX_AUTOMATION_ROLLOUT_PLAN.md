# Codex Automation Rollout Plan

## A) Executive summary

This plan operationalizes the first three PropatyHub Codex automations:

1. Payments Guardian
2. Docs & Help Drift Agent
3. CI & Release Health Agent

These three were chosen because they cover the highest current operational leverage:

- payments readiness and cutover discipline
- documentation drift prevention
- release-gate and workflow health

The architecture already names this first wave as strategically important. The safer rollout order for actual activation should be:

1. Docs & Help Drift Agent
2. CI & Release Health Agent
3. Payments Guardian

Reason:

- Docs & Help Drift is the lowest-risk automation and establishes review-queue discipline.
- CI & Release Health is still bounded to workflows, tests, and release reporting.
- Payments Guardian is high-value but also the most sensitive, so it should be enabled only after the review path and automation habits are stable.

This document should be used with:

- [CODEX_AUTOMATION_ARCHITECTURE.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_ARCHITECTURE.md)
- [CODEX_AUTOMATION_OPERATING_SUMMARY.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_OPERATING_SUMMARY.md)
- [CODEX_RULES.md](/Users/olubusayoadewale/rentnow/docs/CODEX_RULES.md)
- [ROADMAP.md](/Users/olubusayoadewale/rentnow/docs/product/ROADMAP.md)
- [PAYMENTS_PRELIVE_HARDENING_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md)
- [PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md)
- [HELP_COVERAGE_AUDIT.md](/Users/olubusayoadewale/rentnow/docs/product/HELP_COVERAGE_AUDIT.md)
- [ADMIN_OPS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_OPS.md)

## B) Step-0 audit summary

### 1. What the first three automations should do day-to-day

- Docs & Help Drift Agent
  - compare recent shipped surfaces against help, internal docs, and update-note coverage
  - produce drift reports and docs-safe patches
- CI & Release Health Agent
  - watch workflow failures, go-live red tests, and release gate regressions
  - produce triage reports and workflow/test-hygiene patches when low-risk
- Payments Guardian
  - monitor payment-lane readiness, provider config clarity, reconcile health, and cutover blockers
  - produce lane status reports and cutover checklist updates

### 2. Inputs required

- architecture and operating summary docs
- roadmap and current priorities
- payments readiness, routing, hardening, and cutover docs
- admin ops docs
- help coverage audit
- workflow files and recent gate outcomes
- update notes and relevant durable docs

### 3. Outputs required

- audit memo
- drift report
- release triage report
- checklist delta
- docs/update-note patch
- low-risk workflow diagnostics patch

### 4. Review rules

- Docs & Help Drift:
  - docs-only patches may be auto-allowed
  - any product-code change is out of scope without approval
- CI & Release Health:
  - workflow diagnostics and test-only stabilization may be low-risk
  - product-behavior fixes require review
- Payments Guardian:
  - all payment behavior, routing, entitlement, webhook, or live-mode changes are review-required

### 5. Safest rollout order

Use this rollout order:

1. Docs & Help Drift Agent
2. CI & Release Health Agent
3. Payments Guardian

This still respects the architecture’s first-wave focus, but it reduces operational risk during rollout.

## C) Agent rollout details

### 1. Docs & Help Drift Agent

Purpose:

- keep durable help and internal docs aligned with shipped product

Initial schedule:

- every weekday at 14:00 local time
- additional triggered run after merges that touch:
  - `web/app/admin/**`
  - `web/app/api/admin/**`
  - `web/components/admin/**`
  - `web/app/requests/**`
  - `web/app/properties/**`
  - `web/app/host/**`
  - `web/docs/**`
  - `docs/product/**`

Primary inputs:

- [HELP_COVERAGE_AUDIT.md](/Users/olubusayoadewale/rentnow/docs/product/HELP_COVERAGE_AUDIT.md)
- recent `web/docs/updates/**`
- current route and workflow docs
- internal admin docs and role help docs

Expected outputs:

- drift report
- recommended doc updates
- docs patch when the change is clearly docs-only
- update note reminder if a user-visible change lacks a release note

Review gate:

- `report only` if the drift is ambiguous
- `auto-allowed` only for accurate docs-only patches
- `review required` if the drift implies product-behavior change or missing code truth

May touch:

- `docs/product/**`
- `web/docs/**`
- `web/docs/help/**`
- `web/docs/updates/**`

Must not touch without approval:

- product code
- entitlement logic
- admin destructive actions
- payment behavior

Operational success condition:

- future chats can trust durable docs to reflect current shipped product

Current rollout state:

- v1 is now defined as a daily review-queue workflow in [DOCS_HELP_DRIFT_AGENT_V1.md](/Users/olubusayoadewale/rentnow/docs/product/DOCS_HELP_DRIFT_AGENT_V1.md)
- daily output should use [DOCS_HELP_DRIFT_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/DOCS_HELP_DRIFT_REPORT_TEMPLATE.md)
- no autonomous merge behavior is allowed

### 2. CI & Release Health Agent

Purpose:

- keep release gates readable, actionable, and less brittle

Initial schedule:

- every weekday at 09:00 local time
- additionally after merges to `main`

Primary inputs:

- `.github/workflows/**`
- latest Actions failures
- `test:e2e:golive` outcomes
- release-gate helper docs

Expected outputs:

- failure triage report
- grouped root-cause summary
- flaky-test shortlist
- low-risk workflow or test diagnostics patch

Review gate:

- `report only` when failures are not yet understood
- `auto-allowed` for diagnostics-only workflow improvements and non-behavioral test hygiene
- `review required` when a fix changes product runtime behavior or gate semantics

May touch:

- `.github/workflows/**`
- CI helper scripts
- test configuration
- ops/update-note docs about workflow behavior

Must not touch without approval:

- product runtime behavior beyond the smallest test stabilization fix
- payment cutover controls
- release thresholds

Operational success condition:

- failures become diagnosable from GitHub output without guesswork

Current rollout state:

- v1 is now defined as a daily review-queue workflow in [CI_RELEASE_HEALTH_AGENT_V1.md](/Users/olubusayoadewale/rentnow/docs/product/CI_RELEASE_HEALTH_AGENT_V1.md)
- daily output should use [CI_RELEASE_HEALTH_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/CI_RELEASE_HEALTH_REPORT_TEMPLATE.md)
- no autonomous reruns, workflow-policy changes, or merges are allowed

### 3. Payments Guardian

Purpose:

- monitor live-scope payment readiness and enforce cutover discipline lane by lane

Initial schedule:

- every weekday at 08:00 local time
- extra run on the morning of any planned payment cutover

Primary inputs:

- [PAYMENTS_PRELIVE_HARDENING_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md)
- [PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md)
- [PAYMENTS_READINESS_AUDIT_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_READINESS_AUDIT_2026-03-20.md)
- [PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md)
- billing ops surfaces and payment workflows

Expected outputs:

- lane-by-lane readiness report
- blocker list
- cutover checklist delta
- operator note if a payment surface or workflow is drifting

Review gate:

- `report only` by default
- `review required` for any payment code, config, routing, webhook, entitlement, or reconcile change
- `blocked pending approval` for anything involving live secrets, live mode, or provider dashboard actions

May touch:

- `docs/product/*payments*`
- `web/docs/BILLING.md`
- payment ops docs
- low-risk workflow diagnostics that only improve observability

Must not touch without approval:

- live keys
- provider dashboard settings
- live-mode toggles
- billing entitlements
- routing logic
- reconciliation behavior

Operational success condition:

- payments are cut over lane by lane using documented evidence, not memory

Current rollout state:

- v1 is now defined as a daily review-queue workflow in [PAYMENTS_GUARDIAN_V1.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_GUARDIAN_V1.md)
- daily output should use [PAYMENTS_GUARDIAN_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_GUARDIAN_REPORT_TEMPLATE.md)
- no autonomous routing, webhook, secret, entitlement, or cutover changes are allowed

## D) Recommended daily cadence

Use this daily sequence:

1. `08:00` Payments Guardian
   - emit lane status before business-day ops decisions
2. `09:00` CI & Release Health Agent
   - summarize overnight failures and gate status
3. `14:00` Docs & Help Drift Agent
   - patch durable docs after code changes have landed and update notes are available

This ordering reduces the chance of one agent reacting to stale inputs from another.

## E) Review queue format

Every run should produce one review queue item using this structure:

### Header

- agent name
- run timestamp
- classification:
  - `report only`
  - `review required`
  - `blocked pending approval`

### Core fields

- `What changed`
- `Why it matters`
- `Evidence used`
- `Files or surfaces touched`
- `Recommended next step`

### Example

| Field | Example |
| --- | --- |
| Agent | Payments Guardian |
| Classification | Review required |
| What changed | Stripe cutover checklist now shows shortlet webhook ready but billing lane still amber |
| Why it matters | Prevents partial live enablement on one route while another remains unsafe |
| Evidence used | payments cutover plan, billing ops docs, webhook readiness surfaces |
| Files touched | docs-only delta to payment cutover checklist |
| Recommended next step | hold billing-lane cutover until webhook readiness and operator checks are both green |

## F) Allowed-touch boundaries for rollout

During initial rollout, keep each automation tighter than the architecture’s maximum envelope.

### Docs & Help Drift

- allowed:
  - docs and update notes only
- not allowed:
  - product code changes of any kind

### CI & Release Health

- allowed:
  - workflow diagnostics
  - non-behavioral test helpers
  - ops docs
- not allowed:
  - product runtime fixes without review

### Payments Guardian

- allowed:
  - payments docs
  - payment readiness reporting
  - observability/runbook clarifications
- not allowed:
  - payment code or config mutation without approval

## G) Never-autonomous boundaries

The following stay human-controlled even after these automations are live:

- payments live cutover
- provider dashboard edits
- secret rotation
- pricing or plan entitlement changes
- destructive admin actions
- schema deployment to shared environments
- legal or compliance copy changes
- broad UI or information-architecture changes
- permanent delete / purge logic

## H) Operator adoption guidance

Use this adoption pattern:

### Week 1

- enable Docs & Help Drift first
- validate that it produces useful drift reports and safe docs patches
- verify review queue format is readable and consistent

### Week 2

- enable CI & Release Health
- confirm it can distinguish:
  - flaky failures
  - real regressions
  - workflow observability gaps

### Week 3

- enable Payments Guardian
- keep it report-only at first
- only consider low-risk docs/runbook patching after two stable weeks of accurate reporting

## I) Rollout success checks

The rollout is working if:

- docs drift is caught before operators rely on stale guidance
- CI failures become faster to triage
- payment readiness is reported lane by lane with evidence
- no automation crosses into risky product behavior without review

The rollout is not working if:

- automations produce vague summaries with no file or route evidence
- operators cannot tell what is safe to merge
- agents silently patch beyond their declared lane
- payment-sensitive automation starts making behavior changes instead of reporting

## J) Practical adoption rules for future chats

Future chats should treat this rollout plan as the activation layer for the automation architecture:

- use the architecture doc for principles and boundaries
- use this rollout plan for schedules, day-to-day duties, and first-wave operating rules

If an automation is proposed outside these three agents, it should not be activated until:

1. its purpose and boundaries are written to the architecture doc, and
2. its rollout steps are added or referenced here
