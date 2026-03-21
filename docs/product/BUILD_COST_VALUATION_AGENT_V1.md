# Build Cost Valuation Agent v1

## Purpose

Build Cost Valuation Agent v1 is a weekly review-based automation for estimating the added build-cost value of newly shipped work.

It does not calculate accounting truth.

It produces a reviewed weekly increment proposal for the build-cost ledger.

## What the agent does

Every weekly run should:

1. inspect repo changes since the previous successful run
2. classify shipped work by workstream
3. estimate the added effort band
4. apply the three valuation lenses
5. prepare a ledger append proposal
6. produce a short review summary for human approval

## Inputs

The agent should read:

- [BUILD_COST_VALUATION_METHOD.md](/Users/olubusayoadewale/rentnow/docs/product/BUILD_COST_VALUATION_METHOD.md)
- [BUILD_COST_BASELINE_REPORT_2026-03-21.md](/Users/olubusayoadewale/rentnow/docs/product/BUILD_COST_BASELINE_REPORT_2026-03-21.md)
- [BUILD_COST_LEDGER_SPEC.md](/Users/olubusayoadewale/rentnow/docs/product/BUILD_COST_LEDGER_SPEC.md)
- [ROADMAP.md](/Users/olubusayoadewale/rentnow/docs/product/ROADMAP.md)
- current product, payment, help, and ops docs relevant to the changed area
- `web/docs/updates/**` in the review window
- shipped commits in the review window
- changed files in the review window
- the current workbook at `output/spreadsheet/build-cost-ledger-v1.xlsx`

## Schedule

Recommended cadence:

- every Friday at 16:00 Europe/London

Extra runs:

- at month end before stakeholder reporting
- after unusually large shipping weeks
- after payment or shortlets hardening phases that materially change platform breadth

## Workstream classes

Use these primary classes:

1. marketplace/search/discovery
2. listings/host workflows/media
3. property requests
4. admin tooling/ops/analytics
5. billing/payments/monetisation
6. shortlets/bookings/payments
7. docs/help/admin runbooks
8. stability/CI/PWA/release/automation

## Output

Each run should produce two outputs.

### 1. Review summary

Required sections:

1. review window
2. changed files and commit count
3. shipped update notes
4. workstream classification
5. effort band proposed
6. cost impact by lens
7. confidence
8. recommended ledger rows to append
9. reviewer action needed

### 2. Ledger append proposal

Required fields:

- `week_ending`
- `review_window_start`
- `review_window_end`
- `primary_workstream`
- `secondary_workstream`
- `shipped_summary`
- `changed_files_count`
- `commit_count`
- `update_notes_count`
- `effort_person_days_low`
- `effort_person_days_base`
- `effort_person_days_high`
- `lean_add_base`
- `mixed_add_base`
- `agency_add_base`
- `confidence`
- `notes`

## Estimation rules

### Effort band rules

Use person-days, not story points.

Recommended effort bands:

- `XS`: `1-3 person-days`
- `S`: `4-7 person-days`
- `M`: `8-15 person-days`
- `L`: `16-30 person-days`
- `XL`: `31-50 person-days`
- `XXL`: `51+ person-days`

The agent should never stop at a band label only.

It should always convert the band into low, base, and high person-day estimates.

### Confidence rules

- `High`
  - update notes, changed files, and docs all agree
- `Medium`
  - the workstream is obvious, but role mix or breadth is still estimated
- `Low`
  - evidence is thin or heavily mixed across workstreams

### Evidence rules

Prefer these references:

1. dated update notes
2. shipped commits
3. changed files in the workstream area
4. roadmap or product docs showing lane importance

Use `2` to `5` references per weekly summary item, not an overload.

## Spreadsheet workflow

The agent should use the spreadsheet workflow conservatively.

### Allowed in v1

- read the current workbook
- propose one or more new weekly rows
- populate a draft workbook copy or draft row block for review
- preserve formulas and cumulative totals

### Not allowed autonomously

- overwrite approved historical rows
- silently append to the canonical ledger without review
- change formulas without review
- restate the baseline without explicit instruction
- change methodology assumptions silently

## Recommended operational model

### Safe default

- produce the review summary first
- include the exact rows proposed for `Weekly Increments`
- wait for human approval before mutating the canonical workbook

### Optional approved mode later

If the team explicitly approves a tighter automation later, the agent may append reviewed rows into the workbook after generating the review summary.

That is not the default in v1.

## Allowed-touch boundary

The agent may touch:

- valuation docs under `docs/product/`
- weekly review notes under a valuation-specific location if created later
- the ledger workbook under `output/spreadsheet/`

## Never-autonomous boundary

The agent must not autonomously:

- change product code
- change payment behavior
- change roadmap priorities
- change historical valuation assumptions without review
- rewrite prior approved weekly increments
- present the model as audited spend or business valuation
