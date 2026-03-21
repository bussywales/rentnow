# Build Cost Valuation Method

## Purpose

This method estimates what it would realistically cost an external paid team to build PropatyHub from `2025-12-02` to the current repo state.

It is a build-cost valuation model.

It is not:

- audited accounting
- fundraising valuation
- a statement of cash actually spent
- a statement of current market value of the business
- a claim that commit counts convert directly into money

## What this method uses as evidence

This model is grounded in repo truth, especially:

- [ROADMAP.md](/Users/olubusayoadewale/rentnow/docs/product/ROADMAP.md)
- [REVENUE_MODEL_AND_PAYMENT_STAGES.md](/Users/olubusayoadewale/rentnow/docs/product/REVENUE_MODEL_AND_PAYMENT_STAGES.md)
- [PAYMENTS_READINESS_AUDIT_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_READINESS_AUDIT_2026-03-20.md)
- [PAYMENTS_PRELIVE_HARDENING_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_PRELIVE_HARDENING_PLAN.md)
- [PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENTS_FINAL_SMOKE_CHECKLIST_AND_CUTOVER_PLAN.md)
- [HELP_COVERAGE_AUDIT.md](/Users/olubusayoadewale/rentnow/docs/product/HELP_COVERAGE_AUDIT.md)
- [CODEX_AUTOMATION_ARCHITECTURE.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_ARCHITECTURE.md)
- [CODEX_AUTOMATION_ROLLOUT_PLAN.md](/Users/olubusayoadewale/rentnow/docs/product/CODEX_AUTOMATION_ROLLOUT_PLAN.md)
- [ADMIN_OPS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_OPS.md)
- [ADMIN_LISTINGS.md](/Users/olubusayoadewale/rentnow/web/docs/ADMIN_LISTINGS.md)
- `web/docs/updates/**`
- recent commits and changed files since `2025-12-02`

Evidence anchors used in this batch:

- about `1,705` non-merge commits since `2025-12-02`
- about `357` dated update notes under `web/docs/updates`
- about `60` durable help files under `web/docs/help`
- heavy touch counts in:
  - marketplace and discovery surfaces
  - admin and ops surfaces
  - payment and billing surfaces

These counts are evidence of breadth and iteration volume. They are not billed directly.

## Core valuation logic

The model works in four steps.

### 1. Classify shipped work into workstreams

Use these workstream categories:

1. Marketplace, search, discovery, home, saved, collections
2. Listings, host workflows, listing quality, media, demo controls
3. Property Requests and demand workflows
4. Admin tooling, analytics, review, support, ops, legal/settings
5. Billing, payments, monetisation, reconcile, cutover readiness
6. Shortlets, bookings, payments, calendar, trips, host ops
7. Docs, help, admin runbooks, update-note discipline
8. Stability, release gates, PWA, CI, migrations, regression hardening, automation ops

### 2. Estimate person-weeks by workstream

Estimate how many external-team person-weeks would likely be required to reproduce the current shipped state of each workstream.

Important:

- estimate reproduction effort, not founder time spent
- include rework, QA, integration, and release friction
- include non-coding effort where the shipped output clearly required it

### 3. Apply one of three pricing lenses

Use these lenses:

1. `Lean / low-cost`
2. `Realistic mixed-seniority`
3. `Premium / agency`

Each lens applies a different role mix and blended rate.

### 4. Add support-role overhead explicitly

Do not treat this like raw coding only.

Include realistic fractions for:

- product management
- design and UI iteration
- QA and stabilization
- architecture and technical review
- release and DevOps support
- docs/help/admin ops documentation

## Assumptions

### Time window

- build period start: `2025-12-02`
- baseline snapshot date: report date

### Delivery posture assumption

The repo output looks like a fast-moving product build with daily iteration across multiple lanes, not a one-page marketing site and not a single isolated MVP.

The model assumes:

- ongoing product decisions during implementation
- substantial UI iteration and regression fixing
- admin and ops tooling built in parallel with user-facing features
- payments, shortlets, and docs all requiring extra hardening and operational cleanup

### Estimation unit

Use person-weeks for workstream estimation, then convert to cost using 5 billable days per week.

### Confidence rule

Use these confidence labels:

- `High`
  - shipped area is clear from docs, routes, tests, and repeated update notes
- `Medium`
  - the area is clearly real, but the exact amount of iteration is harder to isolate
- `Low`
  - the area exists, but the cost is highly assumption-driven

## Role categories

Use these role buckets for costing.

1. `Implementation engineer`
   - full-stack feature delivery, API work, UI integration, schema wiring
2. `Senior engineer / architect`
   - technical design, payment-risk decisions, release hardening, critical reviews
3. `Product / delivery`
   - scoping, prioritization, acceptance, batch coordination, stakeholder framing
4. `Design / UX`
   - interaction design, visual polish, layout iteration, information architecture
5. `QA / stabilization`
   - smoke coverage, regression testing, edge-case verification, defect retesting
6. `Release / DevOps`
   - build pipeline, deployment readiness, migrations, cron/workflow hygiene
7. `Docs / help / admin ops`
   - runbooks, help content, admin documentation, update-note discipline

## Rate bands

These are not invoices. They are realistic 2026-era UK/global blended delivery assumptions intended for a build-cost model.

### Lean / low-cost lens

- implementation engineer: `£250-£400/day`
- senior engineer / architect: `£450-£650/day`
- product / delivery: `£300-£500/day`
- design / UX: `£275-£450/day`
- QA / stabilization: `£200-£325/day`
- release / DevOps: `£350-£550/day`
- docs / help / admin ops: `£200-£325/day`

### Realistic mixed-seniority lens

- implementation engineer: `£425-£650/day`
- senior engineer / architect: `£650-£950/day`
- product / delivery: `£500-£800/day`
- design / UX: `£450-£700/day`
- QA / stabilization: `£350-£575/day`
- release / DevOps: `£550-£850/day`
- docs / help / admin ops: `£325-£500/day`

### Premium / agency lens

- implementation engineer: `£700-£950/day`
- senior engineer / architect: `£900-£1,250/day`
- product / delivery: `£700-£1,000/day`
- design / UX: `£650-£950/day`
- QA / stabilization: `£500-£800/day`
- release / DevOps: `£800-£1,100/day`
- docs / help / admin ops: `£450-£700/day`

Agency projects are priced above raw staff day rates because they usually include:

- delivery management
- bench and resourcing risk
- QA/process overhead
- account management
- margin

## Market anchors used for sanity checking

These sources are not used as rigid formulas. They are used to keep the rate bands commercially grounded.

- [Morgan McKinley 2026 UK technology contract salary guide](https://www.morganmckinley.com/uk/salary-guide/technology/contract-salaries)
- [Morgan McKinley 2025 UK project and change contract salary guide](https://www.morganmckinley.com/uk/salary-guide/project-change-management/contract-salaries)
- [ContractorUK market rates report](https://www.contractoruk.com/market_rates)
- [Reed UK technology salary guide 2026](https://www.reed.com/tools/technology-salary-guide-2026)

## Workstream estimation rules

### Marketplace, search, discovery

Include:

- home, explore, explore-v2, explore-labs
- rails, discovery experiments, saved/favourites, collections
- card systems, discovery analytics, trust cues

### Listings and host workflows

Include:

- listing create/edit/submit flows
- listing quality system
- media, images, video, demo flags, feature controls
- host properties, leads, workspace, listing manager

### Property Requests

Include:

- request creation
- responder matching
- tenant, landlord, agent, admin flows
- analytics, alerts, lifecycle management

### Admin tooling and ops

Include:

- admin review desk
- listings registry and inspector
- analytics/reporting
- support inbox and ops shortcuts
- legal/settings/admin surfaces

### Billing and payments

Include:

- billing page and plans
- Stripe, Paystack, Flutterwave subscription lanes
- PAYG listing and featured lanes
- reconcile workflows
- payment cutover docs and hardening

### Shortlets

Include:

- discovery and search
- bookings, approvals, return flows
- checkout, payment provider routing, calendar, host and guest flows
- shortlet ops, reminders, agenda, trips

### Docs and help

Include:

- role help docs
- admin runbooks
- update notes
- product operating docs and audit docs

### Stability and release engineering

Include:

- go-live smoke packs
- CI and workflow hardening
- PWA/startup work
- hydration/stability fixes
- migration guardrails
- automation operating docs

## Weekly incremental costing method

The weekly system does not revalue the whole platform from scratch.

It adds a reviewed weekly increment.

For each weekly review window:

1. review merged changes since the previous successful run
2. read changed files, update notes, and shipped commits
3. classify the work into one primary workstream and optional secondary workstream
4. estimate effort added using person-day bands:
   - low
   - base
   - high
5. choose or preserve the lens:
   - lean
   - realistic mixed-seniority
   - premium / agency
6. compute weekly added cost
7. append the weekly increment only after human review

## Smallest practical weekly system

The smallest useful weekly valuation system is:

- one spreadsheet ledger
- one weekly review summary
- one reviewed row block added to `Weekly Increments`
- automatic formula updates in `Cumulative Totals`

V1 should be review-based.

It should not silently mutate the ledger without human approval.

## What future chats should not do

- do not present this as audited spend
- do not treat commit count as direct cost
- do not inflate build value by copying headline agency rates without role mix
- do not underprice by assuming one junior developer could produce this output alone
- do not silently rewrite historical weekly rows without review notes
