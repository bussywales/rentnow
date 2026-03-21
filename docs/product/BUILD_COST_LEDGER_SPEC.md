# Build Cost Ledger Spec

## Purpose

This spec defines the spreadsheet ledger used to track:

- the baseline build-cost valuation
- weekly estimated build-cost increments
- cumulative totals by pricing lens
- confidence and review notes

The ledger is a management tool.

It is not a finance ledger, not audited spend, and not a replacement for accounts.

## Recommended file

Primary workbook:

- `output/spreadsheet/build-cost-ledger-v1.xlsx`

Batch v1 note:

- this batch defines the workbook structure and formulas
- if a local spreadsheet runtime is unavailable, keep the ledger review-based and create the workbook in the next spreadsheet-enabled batch rather than forcing a new dependency into a docs-first change

## Required tabs

1. `README`
2. `Assumptions`
3. `Baseline Valuation`
4. `Weekly Increments`
5. `Cumulative Totals`
6. `Workstream Log`
7. `Notes & Confidence`

## 1. README tab

Purpose:

- explain how to use the workbook
- identify the valuation date and current owner
- warn that this is an estimate model

Recommended fields:

- workbook version
- current methodology doc
- baseline snapshot date
- current reviewer
- weekly update cadence
- last reviewed at
- model warning

## 2. Assumptions tab

Purpose:

- hold all rate, overhead, and model assumptions in one place

Recommended columns:

- `assumption_key`
- `category`
- `lens`
- `value_low`
- `value_base`
- `value_high`
- `unit`
- `source_url`
- `source_type`
- `reviewed_at`
- `owner`
- `notes`

Suggested rows:

- build start date
- person-days per week
- lean blended day rate
- mixed blended day rate
- agency blended day rate
- support overhead percentages
- continuation monthly burn bands
- confidence policy labels

## 3. Baseline Valuation tab

Purpose:

- store the initial baseline estimate by workstream and by valuation lens

Recommended columns:

- `snapshot_date`
- `build_start_date`
- `build_end_date`
- `workstream`
- `evidence_summary`
- `confidence`
- `person_weeks_low`
- `person_weeks_base`
- `person_weeks_high`
- `lean_cost_low`
- `lean_cost_base`
- `lean_cost_high`
- `mixed_cost_low`
- `mixed_cost_base`
- `mixed_cost_high`
- `agency_cost_low`
- `agency_cost_base`
- `agency_cost_high`
- `notes`

Formula guidance:

- cost columns should use formulas referencing the `Assumptions` tab where practical
- totals row should sum the workstream rows directly above

## 4. Weekly Increments tab

Purpose:

- append one reviewed row or block per weekly review window

Recommended columns:

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
- `lean_add_low`
- `lean_add_base`
- `lean_add_high`
- `mixed_add_low`
- `mixed_add_base`
- `mixed_add_high`
- `agency_add_low`
- `agency_add_base`
- `agency_add_high`
- `confidence`
- `next_action`
- `notes`

Rules:

- one row for compact weeks
- one block of rows if multiple major workstreams shipped in the same week
- do not overwrite historical rows silently

## 5. Cumulative Totals tab

Purpose:

- show running totals by valuation lens
- make the workbook immediately useful to founders and operators

Recommended sections:

### Baseline totals

Columns:

- `lens`
- `baseline_low`
- `baseline_base`
- `baseline_high`

### Weekly additions to date

Columns:

- `lens`
- `weekly_low_total`
- `weekly_base_total`
- `weekly_high_total`

### Current cumulative estimate

Columns:

- `lens`
- `cumulative_low`
- `cumulative_base`
- `cumulative_high`

### Monthly continuation assumptions

Columns:

- `lens`
- `monthly_continuation_low`
- `monthly_continuation_base`
- `monthly_continuation_high`

Formula guidance:

- sum baseline plus all approved weekly increments
- ignore rows where `approval_status` is not approved

## 6. Workstream Log tab

Purpose:

- keep a simpler narrative log of what each weekly increment covered

Recommended columns:

- `week_ending`
- `workstream`
- `batch_title`
- `summary`
- `important_files`
- `important_update_notes`
- `impact_level`
- `confidence`
- `reviewer_note`

This tab is for readability. The financial math should live in `Weekly Increments` and `Cumulative Totals`.

## 7. Notes & Confidence tab

Purpose:

- preserve model caveats and explicit review remarks

Recommended columns:

- `date`
- `entry_type`
- `lens`
- `workstream`
- `confidence_change`
- `reason`
- `owner`
- `follow_up`

Use cases:

- note when a week was unusually heavy but still low-confidence
- explain why a batch was split across two workstreams
- record why an increment was approved or rejected

## Spreadsheet update rules

1. Weekly increments must be review-based.
2. The workbook should preserve formulas in `Cumulative Totals`.
3. Historical baseline rows should not be edited without a note in `Notes & Confidence`.
4. If a weekly run is skipped, the next run should widen the review window and say so.
5. If evidence is weak, lower confidence instead of faking precision.

## Recommended formatting

- blue text for user-editable assumptions
- black text for formulas
- teal or green highlight for cumulative KPI cells
- orange fill for review-needed or low-confidence rows
- red fill for rejected increments or inconsistent evidence

## Minimum viable weekly workflow

1. open the workbook
2. duplicate the prior review row if the structure is reused
3. update review window and evidence counts
4. add workstream classification and cost band
5. set approval status only after human review
6. confirm cumulative formulas update correctly
7. save workbook and note the update in the weekly review summary
