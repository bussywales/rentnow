# Build Cost Baseline Report

## Snapshot

- build period start: `2025-12-02`
- baseline snapshot date: `2026-03-21`
- elapsed calendar time: about `16` weeks
- evidence used:
  - about `1,705` non-merge commits since start date
  - about `357` dated update notes
  - about `60` help files plus substantial admin/operator documentation

## Executive Summary

PropatyHub is no longer a simple marketplace MVP.

Repo truth shows a multi-surface product with:

- consumer discovery and saved flows
- host listing creation and quality workflows
- Property Requests supply-demand workflows
- admin moderation, support, analytics, ops, and settings surfaces
- multi-provider billing and payment infrastructure
- shortlets booking and payment workflows
- a large help/runbook/update-note layer
- repeated stabilization, release-gate, and migration discipline work

### Most believable central estimate

For an external paid team to build the current platform from `2025-12-02` to today, the most believable range is:

- `£320,000 to £520,000`

Central working figure:

- `about £410,000`

This is the realistic mixed-seniority lens.

### Lean / low-cost build path

- `£170,000 to £300,000`

### Premium / agency build path

- `£520,000 to £950,000`

### Plain-English founder summary

If you asked an external team to reproduce what now exists in the repo, a serious low-cost execution path is still well into six figures, a believable product-team build is roughly low-to-mid six figures, and a reputable agency would likely quote comfortably above half a million pounds and could push toward seven figures once PM, QA, design, and delivery overhead are included.

## Major workstreams built since 2025-12-02

### 1. Marketplace, search, discovery, and engagement

Evidence examples:

- explore, explore-v2, explore-labs iteration
- home, rails, market-aware browse, quick-search, saved, collections
- trust cues, CTA experiments, conversion analytics
- heavy touch count in discovery-facing surfaces

Representative shipped areas:

- explore vertical paging and media behavior
- mobile discovery and quick-search systems
- collections and saved flows
- trust signals and analytics

Estimated effort:

- `22 to 30 person-weeks`
- confidence: `Medium`

### 2. Listings, host workflows, listing quality, and media

Evidence examples:

- listing editor improvements
- best-next-fix guidance
- listing quality scoring and telemetry
- demo listing controls and visibility policy
- media/video/image delivery work

Representative shipped areas:

- host properties manager
- listing completeness system
- demo listing lifecycle and presentation
- media reliability and video hero behavior

Estimated effort:

- `18 to 24 person-weeks`
- confidence: `High`

### 3. Property Requests demand workflow

Evidence examples:

- request creation, board, responses, extend flow
- responder alerts
- admin moderation and analytics
- durable help docs and product spec

Representative shipped areas:

- tenant request creation and management
- host/agent response workflow
- admin requests registry and inspector
- request telemetry and notifications

Estimated effort:

- `10 to 14 person-weeks`
- confidence: `High`

### 4. Admin tooling, support, analytics, and operator surfaces

Evidence examples:

- admin analytics IA
- listings registry and inspector
- support inbox and SLA tooling
- settings/search/navigation improvements
- admin docs and ops surfaces

Representative shipped areas:

- review desk and registry improvements
- support ops console
- admin discovery diagnostics
- host analytics exposure inside admin

Estimated effort:

- `18 to 26 person-weeks`
- confidence: `High`

### 5. Billing, payments, monetisation, and cutover preparation

Evidence examples:

- subscription billing lanes
- PAYG listing and featured payments
- Paystack and Stripe hardening phases
- reconcile workflow, cutover docs, provider routing decision

Representative shipped areas:

- Stripe webhook hardening
- Paystack config unification
- subscription success backstop
- featured payments canonical model
- billing ops and readiness audits

Estimated effort:

- `14 to 20 person-weeks`
- confidence: `High`

### 6. Shortlets product lane

Evidence examples:

- discovery, map, sticky controls, filters, payment return, trips
- host inbox, reminders, agenda, calendar, payouts transparency
- shortlet payment routing and reconcile work

Representative shipped areas:

- guest browse and checkout
- host booking approvals and reminders
- trips and stay flows
- shortlet payment lanes and ops tooling

Estimated effort:

- `20 to 28 person-weeks`
- confidence: `Medium`

### 7. Docs, help, training, admin runbooks

Evidence examples:

- about `60` help docs
- about `357` dated update notes
- payments audits, roadmap, readiness docs, automation docs

Representative shipped areas:

- role help coverage
- admin/operator runbooks
- roadmap and audit documents
- update-note discipline across releases

Estimated effort:

- `6 to 10 person-weeks`
- confidence: `High`

### 8. Stability, release gates, PWA, CI, migrations, automation ops

Evidence examples:

- repeated go-live stabilization
- PWA/startup-shell work
- migration guardrails
- CI/release health docs and agent rollout docs

Representative shipped areas:

- go-live smoke pack stabilization
- hydration/runtime fixes
- startup shell and installability work
- automation rollout docs and operational guardrails

Estimated effort:

- `12 to 18 person-weeks`
- confidence: `Medium`

## Total effort view

### Core reproduced build effort

Estimated total:

- `120 to 170 person-weeks`

Equivalent person-days:

- `600 to 850 days`

This already assumes a fair amount of overlap between engineering, design, QA, and product work. It is not a raw sum of every possible contributor at full utilization.

## Cost lenses

## A) Lean / low-cost build lens

Assumptions:

- one strong full-stack lead or senior contractor carrying architecture
- heavier use of lower-mid contractors for implementation
- lighter QA and design involvement
- product and documentation handled part-time
- low admin overhead and limited formal delivery management

Blended cost logic:

- blended delivery rate roughly `£270 to £350/day`
- total delivered cost roughly `£170,000 to £300,000`

Interpretation:

- this is the cheapest believable lane
- it still assumes disciplined contractors, not bargain-basement fantasy pricing
- it also assumes a fairly aggressive founder-like decision cadence and limited process overhead

## B) Realistic mixed-seniority lens

Assumptions:

- senior technical leadership present for platform and payment decisions
- mid-level implementation capacity for day-to-day feature delivery
- real QA/stabilization work rather than “developer tests only”
- meaningful docs/help/admin ops effort
- enough product/design involvement to support multi-surface UX changes

Blended cost logic:

- blended delivery rate roughly `£450 to £610/day`
- total delivered cost roughly `£320,000 to £520,000`

Central estimate:

- `about £410,000`

Interpretation:

- this is the most believable lens for stakeholder conversations
- it fits the breadth of what has shipped without pretending the platform required a large enterprise team

## C) Premium / agency lens

Assumptions:

- agency squad with PM, design, engineering, QA, and delivery overhead
- higher seniority, stronger process, more formal QA, more discovery packaging
- margin and account-management overhead included

Blended cost logic:

- blended delivery rate roughly `£800 to £1,120/day`
- total delivered cost roughly `£520,000 to £950,000`

Interpretation:

- a credible UK or international agency would likely quote in this zone to build the current breadth with proper delivery coverage
- if the scope were packaged as a formal marketplace plus shortlets plus admin plus payments build from scratch, quotes at the upper end would not be surprising

## What a dev agency would likely charge

### To build the current platform from scratch to this repo state

Likely agency quote band:

- `£550,000 to £950,000`

Why:

- multi-role marketplace product
- user + host + admin + ops surfaces
- complex shortlets lane
- payments and billing risk
- repeated UI iteration and stabilization
- documentation and operator materials

### To continue building it seriously from here

Likely monthly continuation cost:

- lean retained specialist path: `£18,000 to £30,000 / month`
- realistic mixed-seniority product team: `£35,000 to £65,000 / month`
- serious agency / retained squad: `£70,000 to £140,000 / month`

## Supporting resource costs that should not be ignored

Even when the feature work is engineering-led, these roles are real cost drivers.

### Product management

Use for:

- priority shaping
- scope control
- acceptance criteria
- launch/cutover coordination

### QA and stabilization

Use for:

- smoke coverage
- browser/device regression checks
- release gate recovery
- verifying payment and admin workflows

### Design and UI iteration

Use for:

- discovery surface polish
- admin IA cleanup
- host flow readability
- multi-surface interaction design

### Architecture and senior review

Use for:

- payment hardening
- route and data-model choices
- release-risk mitigation
- shared-system decisions

### Release and DevOps

Use for:

- CI/workflow maintenance
- migration deployment discipline
- cron/reconcile operations
- production-readiness checks

### Docs, help, and admin ops coverage

Use for:

- durable help
- operator runbooks
- update-note history
- audit and cutover docs

## Limits and confidence

This report is commercially useful, not forensic.

Main limits:

- repo history shows breadth and iteration, but not every meeting, discarded branch, or off-repo discussion
- one highly productive founder-plus-AI workflow can ship faster than a normal external team, so reproduction cost is usually higher than “time spent”
- agency packaging varies heavily by geography, seniority mix, and discovery overhead

Confidence by lens:

- lean: `Medium`
- realistic mixed-seniority: `High`
- premium / agency: `Medium`

## Recommended stakeholder usage

Use the `realistic mixed-seniority` lens as the default talking number.

Use the lean lens only to answer “what is the lowest believable reproduction cost?”

Use the premium / agency lens when comparing against agency quotations, retained studio proposals, or outsourced delivery offers.
