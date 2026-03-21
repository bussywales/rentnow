# Codex Automation Architecture

## A) Operating model overview

PropatyHub should use Codex in three layers:

1. Scheduled automations that watch known operating surfaces.
2. Specialist agents that own one domain each and produce bounded outputs.
3. Human review for anything that can change live product behavior, live payments, destructive data, or policy.

This operating model is meant to reduce drift, not create autonomous chaos. Codex should be used to:

- detect issues early
- turn repo truth into durable docs and checklists
- keep ops and help materials current
- prepare review-ready patches for low-risk changes
- keep decision-making evidence-based

This operating model should be read alongside:

- [ROADMAP.md](/Users/olubusayoadewale/rentnow/docs/product/ROADMAP.md)
- [PAYMENTS_PRELIVE_HARDENING_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md)
- [PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md)
- [MARKETPLACE_REVIEW_2026-03-16.md](/Users/olubusayoadewale/rentnow/docs/product/MARKETPLACE_REVIEW_2026-03-16.md)
- [MARKETPLACE_REVIEW_CHECKLIST.md](/Users/olubusayoadewale/rentnow/docs/product/MARKETPLACE_REVIEW_CHECKLIST.md)
- [HELP_COVERAGE_AUDIT.md](/Users/olubusayoadewale/rentnow/docs/product/HELP_COVERAGE_AUDIT.md)
- [ADMIN_OPS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_OPS.md)
- [CODEX_RULES.md](/Users/olubusayoadewale/rentnow/docs/CODEX_RULES.md)

## B) Default output types

Agents should default to producing one of these outputs:

- audit memo
- status report
- ranked issue list
- decision note
- checklist delta
- docs/update-note patch
- low-risk workflow or test hygiene patch

Agents should not default to writing product code unless the automation definition explicitly allows it.

## C) Change classes

### Auto-allowed changes

These are acceptable for automation to propose and, where explicitly permitted, apply without prior human approval:

- docs-only updates
- update notes
- checklist refreshes
- help coverage sync
- workflow diagnostics improvements
- test-only stabilization that does not change product behavior
- admin/operator visibility copy clarifications

### Review-required changes

These require a human review queue before merge:

- product UI behavior changes
- analytics interpretation changes
- admin action changes
- payment workflow hardening
- API contract changes
- test-gate config changes
- changes that alter operational meaning in admin surfaces

### Never-autonomous changes

These must not be executed without explicit human approval:

- live secret changes
- provider dashboard changes
- payments live cutover
- plan entitlement or pricing changes
- destructive data operations
- schema pushes to shared environments
- broad navigation redesign
- moderation-policy shifts
- legal/copy promises about payments or monetisation
- irreversible purge or delete logic

## D) Review rules

Every agent run should classify its output into one of three buckets:

1. `report only`
2. `review required`
3. `blocked pending approval`

The default should be `report only` unless the automation explicitly exists to maintain low-risk docs or workflow hygiene.

Review rules:

- Evidence first. Agent outputs should cite the routes, docs, workflows, or helpers they used.
- No vague summaries. If a claim is operationally important, point to the file or surface.
- No silent escalation. If a task crosses into risky territory, the agent should stop and label the blocker.
- No hidden scope creep. If a fix touches multiple domains, the agent should split the work or route it to the right specialist.

## E) Allowed-touch boundaries

Each agent should have an explicit allowed-touch boundary:

- `docs/product/**`
- `web/docs/**`
- specific workflow files under `.github/workflows/**`
- specific admin routes or read models when the agent is an ops-focused maintenance agent

Agents should not touch unrelated surfaces just because they are nearby. A specialist agent that audits a problem may reference a broader system, but it should only patch the files inside its declared operating lane unless escalated.

## F) Named agents

### 1. Payments Guardian

Purpose:

- monitor payment lane readiness, webhook integrity, reconcile drift, and launch discipline

Schedule:

- every weekday morning
- additionally before any planned live payment cutover

Inputs:

- [PAYMENTS_READINESS_AUDIT_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_READINESS_AUDIT_2026-03-20.md)
- [PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md)
- [PAYMENTS_PRELIVE_HARDENING_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md)
- [PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md)
- billing/admin routes and workflow status

Outputs:

- lane status report
- blocker list
- cutover checklist delta
- docs or workflow diagnostics patch when low-risk

Review rules:

- any change to provider routing, secrets, live mode, webhooks, entitlements, or billing state is review-required

May touch:

- `docs/product/*payments*`
- `web/docs/BILLING.md`
- payment ops docs
- low-risk workflow diagnostics

Must not touch without approval:

- live keys
- provider mode toggles
- plan enforcement logic
- provider routing logic
- production reconciliation behavior

### 2. Marketplace Quality Agent

Purpose:

- monitor demand/supply quality signals across Explore V2, Host Quality, and Property Requests

Schedule:

- weekly

Inputs:

- [MARKETPLACE_REVIEW_2026-03-16.md](/Users/olubusayoadewale/rentnow/docs/product/MARKETPLACE_REVIEW_2026-03-16.md)
- [MARKETPLACE_REVIEW_CHECKLIST.md](/Users/olubusayoadewale/rentnow/docs/product/MARKETPLACE_REVIEW_CHECKLIST.md)
- admin analytics/help docs

Outputs:

- weekly signal review
- ranked bottleneck memo
- checklist updates
- low-risk docs clarifications

Review rules:

- experimental interpretation can be documented automatically
- experiment changes or product behavior changes require review

May touch:

- marketplace review docs
- analytics interpretation docs
- admin help docs

Must not touch without approval:

- ranking logic
- trust signal behavior
- public CTA variants
- moderation thresholds

### 3. CI & Release Health Agent

Purpose:

- monitor release gates, workflow failures, flaky tests, and operational regressions

Schedule:

- after merges to `main`
- daily summary run on weekdays

Inputs:

- GitHub workflow files
- recent CI failures
- go-live suite status
- release-related docs

Outputs:

- failure triage report
- flaky-test shortlist
- workflow hardening patch
- release-risk summary

Review rules:

- workflow diagnostics or test-only fixes may be auto-allowed
- product-facing code changes to satisfy tests require review

May touch:

- `.github/workflows/**`
- CI helper scripts
- test config
- docs/update notes for ops

Must not touch without approval:

- application feature behavior beyond the minimum needed for deterministic tests
- release gating thresholds

### 4. Docs & Help Drift Agent

Purpose:

- keep help, internal docs, and operator guidance aligned with shipped product

Schedule:

- daily on weekdays
- additionally after any merge that touches admin, billing, requests, listings, or analytics surfaces

Inputs:

- [HELP_COVERAGE_AUDIT.md](/Users/olubusayoadewale/rentnow/docs/product/HELP_COVERAGE_AUDIT.md)
- shipped update notes
- route changes
- internal docs under `web/docs/**`

Outputs:

- drift report
- docs patch
- help coverage audit refresh

Review rules:

- docs-only changes are auto-allowed if they reflect repo truth accurately

May touch:

- `docs/product/**`
- `web/docs/**`
- `web/docs/help/**`
- `web/docs/updates/**`

Must not touch without approval:

- product code, except trivial docs wiring explicitly requested

### 5. Growth & Funnel Agent

Purpose:

- review discoverability, funnel friction, and conversion interpretation on key user journeys

Schedule:

- weekly

Inputs:

- Explore V2 analytics docs
- marketplace review docs
- navigation and quick-start changes
- saved/search/requests activation changes

Outputs:

- funnel review memo
- entry-point recommendation list
- experiment interpretation note

Review rules:

- recommendations are allowed
- experiment rollout, navigation changes, or event-model changes require review

May touch:

- product decision docs
- funnel review docs
- update notes

Must not touch without approval:

- live funnel behavior
- CTA copy
- experiment traffic allocation
- analytics schema

### 6. Admin Ops Agent

Purpose:

- keep admin control surfaces, runbooks, and operator expectations accurate and usable

Schedule:

- weekly

Inputs:

- [ADMIN_OPS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_OPS.md)
- admin listings/help docs
- recent admin-related update notes
- workflow and billing ops docs

Outputs:

- ops-readiness memo
- runbook updates
- control-surface gap list

Review rules:

- runbook updates are auto-allowed
- any change to admin destructive actions, privileges, or moderation semantics requires review

May touch:

- `web/docs/ADMIN_OPS.md`
- admin help docs
- admin operational notes

Must not touch without approval:

- admin permissions
- destructive actions
- payment cutover controls

### 7. Product Strategy Agent

Purpose:

- synthesize roadmap, audits, payments status, marketplace quality signals, and monetisation readiness into ranked next decisions

Schedule:

- weekly
- before planning or review sessions

Inputs:

- [ROADMAP.md](/Users/olubusayoadewale/rentnow/docs/product/ROADMAP.md)
- marketplace review docs
- payments readiness and hardening docs
- revenue model docs
- help coverage audit

Outputs:

- ranked decision memo
- priority recommendations
- scope-bounding note for the next batch

Review rules:

- document recommendations automatically
- changes to roadmap priority should still be reviewed by product leadership

May touch:

- roadmap-adjacent decision docs
- review memos
- planning summaries

Must not touch without approval:

- implementation code
- live experiments
- pricing or entitlement strategy

## G) Recommended first agents to stand up

Start with the agents that reduce operational risk fastest:

1. Payments Guardian
2. CI & Release Health Agent
3. Docs & Help Drift Agent
4. Admin Ops Agent

Reason:

- they reduce drift and operational ambiguity immediately
- they fit current PropatyHub pain points
- they can produce high-value outputs before any autonomous product behavior is considered

Then add:

5. Marketplace Quality Agent
6. Product Strategy Agent
7. Growth & Funnel Agent

## H) Recommended daily and weekly cadence

### Daily cadence

- Payments Guardian: weekday morning
- CI & Release Health Agent: after merges and daily summary
- Docs & Help Drift Agent: weekday afternoon or post-merge

### Weekly cadence

- Marketplace Quality Agent: once per week
- Admin Ops Agent: once per week
- Growth & Funnel Agent: once per week
- Product Strategy Agent: once per week or before review meetings

## I) Review-queue discipline

All agents should feed a review queue with clear labels:

- `docs-only`
- `ops-safe`
- `needs product review`
- `needs engineering review`
- `blocked pending approval`

The review queue should answer:

1. what changed
2. why it matters
3. what evidence it used
4. what it touched
5. whether it is safe to merge

## J) Never-autonomous rules for risky changes

The following must remain human-controlled:

- payment provider live enablement
- payment secret rotation
- webhook dashboard changes
- pricing changes
- entitlement changes
- schema push to shared or production-linked environments
- destructive listing or user purge operations
- permanent delete rollout logic
- legal/policy copy changes
- broad UI redesigns
- changes that could cause revenue loss or incorrect access control

## K) How future chats should use this document

Future Codex chats should use this document as the top-level operating model when deciding:

- which specialist agent owns a task
- whether a change is docs-only, review-required, or blocked
- what schedule and cadence make sense
- what boundaries an automation should observe

If a future task conflicts with this document, the task should either:

1. explicitly update this document, or
2. state why it is a one-off exception

