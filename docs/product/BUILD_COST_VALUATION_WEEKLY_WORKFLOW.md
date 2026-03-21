# Build Cost Valuation Weekly Workflow

## Purpose

This workflow defines how PropatyHub should review one weekly shipping window and turn it into a reviewed build-cost increment proposal against:

- [build-cost-ledger-v1.xlsx](/Users/olubusayoadewale/rentnow/output/spreadsheet/build-cost-ledger-v1.xlsx)

This is a review workflow.

It is not:

- autonomous ledger mutation
- accounting
- cash-spend reporting
- market valuation

## Source of Truth

Use these artifacts together:

- [BUILD_COST_VALUATION_METHOD.md](/Users/olubusayoadewale/rentnow/docs/product/BUILD_COST_VALUATION_METHOD.md)
- [BUILD_COST_BASELINE_REPORT_2026-03-21.md](/Users/olubusayoadewale/rentnow/docs/product/BUILD_COST_BASELINE_REPORT_2026-03-21.md)
- [BUILD_COST_LEDGER_SPEC.md](/Users/olubusayoadewale/rentnow/docs/product/BUILD_COST_LEDGER_SPEC.md)
- [BUILD_COST_VALUATION_AGENT_V1.md](/Users/olubusayoadewale/rentnow/docs/product/BUILD_COST_VALUATION_AGENT_V1.md)
- [build-cost-ledger-v1.xlsx](/Users/olubusayoadewale/rentnow/output/spreadsheet/build-cost-ledger-v1.xlsx)

## Step-0 Audit Summary

### 1. Exact weekly inputs to review

Review only the window since the previous successful weekly valuation run unless a wider backfill is explicitly requested.

Required inputs:

- merged commits in the review window
- changed files in the review window
- dated update notes in `web/docs/updates/**`
- major shipped work reflected in durable docs
- migrations, tests, docs, help, admin, payment, shortlets, and stability changes
- the current workbook rows already present in:
  - `Weekly Increments`
  - `Workstream Log`
  - `Notes & Confidence`

### 2. How work should be classified

Classify each weekly shipment into one primary workstream and, if needed, one secondary workstream:

1. marketplace/search/discovery
2. listings/host workflows/media
3. property requests
4. admin tooling/ops/analytics
5. billing/payments/monetisation
6. shortlets/bookings/payments
7. docs/help/admin runbooks
8. stability/CI/PWA/release/automation

### 3. How weekly valuation should be estimated

Estimate incremental person-days first, then apply the three pricing lenses:

1. `lean / low-cost`
2. `realistic mixed-seniority`
3. `premium / agency`

Do not estimate from commit count alone.

Use:

- scope breadth
- changed surface count
- difficulty/risk of the area
- required supporting roles
- regression/stabilisation overhead
- documentation and operational overhead where visible

### 4. What the review artifact should look like

Use a weekly report with:

1. review window
2. input summary
3. grouped shipped work
4. workstream classification
5. effort band with low/base/high person-days
6. cost impact by lens
7. proposed ledger rows
8. cumulative impact summary
9. review decision

### 5. Safest v1 ledger-update workflow

Safest v1:

1. prepare the weekly report first
2. prepare exact draft row values for the workbook
3. require explicit human review
4. only after acceptance, append reviewed rows into:
   - `Weekly Increments`
   - `Workstream Log`
   - `Notes & Confidence`
5. let `Cumulative Totals` update only through formulas already in the workbook

## Review Window

Recommended weekly cadence:

- every Friday
- review window runs from the day after the previous successful weekly review through the current Friday close

Window rules:

- if the previous week was skipped, expand the window and state that explicitly
- if a very large batch spans multiple workstreams, split the week into multiple proposed rows rather than forcing one blended number

## Weekly Inputs

Every weekly review should gather:

### Repo evidence

- merged commit list
- changed file list
- migration files
- new or changed tests
- major route/component/helper changes

### Product and ops evidence

- update notes in the window
- docs/help/admin ops changes
- payment/admin/shortlets/stability documents updated in the window

### Ledger evidence

- current last approved weekly row
- current cumulative totals
- existing notes or confidence adjustments from prior weeks

## Workstream Classification Rules

### Primary workstream

Choose the workstream that best reflects the dominant shipped outcome.

### Secondary workstream

Use only when a week clearly spans a second meaningful delivery lane.

Examples:

- billing lane plus operator docs: `billing/payments/monetisation` primary, `docs/help/admin runbooks` secondary
- shortlets bug fix plus go-live gate recovery: `shortlets/bookings/payments` primary, `stability/CI/PWA/release/automation` secondary

### Split-row rule

Use separate proposed rows when:

- two lanes each represent material work
- the role mix differs meaningfully
- confidence is lower if blended into one row

## Effort Estimation Rules

Use person-days, not story points.

### Band guidance

- `XS`: `1-3`
- `S`: `4-7`
- `M`: `8-15`
- `L`: `16-30`
- `XL`: `31-50`
- `XXL`: `51+`

Every proposed row must include:

- `effort_person_days_low`
- `effort_person_days_base`
- `effort_person_days_high`

### What to include

- implementation work clearly shipped
- technical review and architecture overhead where the lane required it
- QA and stabilization effort visible from tests, fixes, or gate work
- docs/help/admin ops effort when the week included durable documentation or operator materials

### What not to do

- do not map one commit to one cost unit
- do not count docs-only noise as a large engineering week
- do not restate the baseline

## Valuation Lens Application

For each proposed row, apply all three lenses using the assumptions already in the workbook:

- lean / low-cost
- realistic mixed-seniority
- premium / agency

Recommended role-mix notes:

- `engineering only`
- `engineering + QA`
- `engineering + QA + docs`
- `mixed engineering + PM + QA`
- `senior-heavy hardening`
- `agency-style cross-functional`

The role-mix label should explain the nature of the week, even though the workbook formulas use the blended day-rate rows from `Assumptions`.

## Review Artifact

Use:

- [BUILD_COST_VALUATION_WEEKLY_REPORT_TEMPLATE.md](/Users/olubusayoadewale/rentnow/docs/product/BUILD_COST_VALUATION_WEEKLY_REPORT_TEMPLATE.md)

Required sections:

1. Summary
2. Review window
3. Input evidence
4. Shipped work grouped by workstream
5. Proposed weekly increment rows
6. Cumulative impact
7. Confidence and caveats
8. Review decision

## Workbook Mapping

### 1. `Weekly Increments`

For each accepted row, populate:

- `week_ending`
- `review_window_start`
- `review_window_end`
- `run_id`
- `reviewer`
- `approval_status`
- `changed_files_count`
- `commit_count`
- `update_notes_count`
- `primary_workstream`
- `secondary_workstream`
- `shipped_summary`
- `evidence_refs`
- `effort_person_days_low`
- `effort_person_days_base`
- `effort_person_days_high`
- `role_mix_applied`
- `confidence`
- `next_action`
- `notes`

Leave the cost columns formula-driven.

### 2. `Cumulative Totals`

Do not write directly into the cumulative math cells.

Expected behavior:

- approved rows in `Weekly Increments` automatically flow into cumulative totals
- draft, revised, or rejected rows must not affect the cumulative totals

### 3. `Workstream Log`

Append one readable row for each accepted weekly increment row.

Use it to preserve:

- batch title
- summary
- important files
- important update notes
- reviewer note

### 4. `Notes & Confidence`

Append a note when:

- a week was split across multiple rows
- confidence changed materially
- a week was reviewed but rejected
- the evidence was thin or unusually mixed

## Review Decisions

Allowed decisions:

- `accept`
- `revise`
- `reject`

### Accept

- mark proposed rows as approved
- append them into the workbook
- add any necessary log and confidence notes

### Revise

- keep rows in draft
- adjust classification, effort range, or notes
- rerun review before appending

### Reject

- do not append valuation rows
- add a short note explaining why the proposal was rejected if the review artifact should be preserved

## Allowed vs Review-Required

### Auto-preparable

- collecting merged commits
- counting changed files
- listing relevant update notes
- grouping changes into provisional workstreams
- drafting proposed weekly rows
- drafting confidence notes

### Human-approved only

- marking a row `approved`
- appending accepted rows into the canonical workbook
- changing prior approved rows
- changing assumptions or baseline values

## Operator Checklist

Before approval:

1. confirm the review window is correct
2. confirm major shipped areas are not missing
3. confirm the primary and secondary workstreams make sense
4. confirm the effort range is commercially plausible
5. confirm confidence is honest
6. confirm the notes explain any ambiguity

After approval:

1. append the accepted row block to `Weekly Increments`
2. append narrative rows to `Workstream Log`
3. append any needed caveat to `Notes & Confidence`
4. verify that `Cumulative Totals` now reflects only the approved additions

## Guardrails

Never do these autonomously:

- silently change baseline assumptions
- silently rewrite existing approved rows
- present valuation as accounting truth
- make unrelated app-code changes
- turn weekly cost estimates into fundraising or market valuation claims
