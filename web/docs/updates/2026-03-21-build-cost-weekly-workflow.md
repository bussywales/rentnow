---
title: "Build Cost Weekly Workflow"
audiences:
  - ADMIN
areas:
  - docs
  - ops
  - valuation
  - automation
published_at: "2026-03-21"
source_ref: "docs/product/BUILD_COST_VALUATION_WEEKLY_WORKFLOW.md"
---

# Build Cost Weekly Workflow

We documented the weekly review workflow for the PropatyHub build-cost valuation system.

## What was added

- a canonical weekly workflow for reviewing repo changes against the build-cost ledger
- a weekly report template for preparing proposed valuation rows
- explicit workbook mapping for:
  - `Weekly Increments`
  - `Cumulative Totals`
  - `Workstream Log`
  - `Notes & Confidence`
- tighter review rules for what can be auto-prepared versus what must remain human-approved

## What the workflow is for

This workflow makes the valuation system usable week by week.

It defines how to:

- review one weekly shipping window
- classify shipped work into workstreams
- estimate incremental person-days and cost by lens
- prepare draft ledger rows without silently changing the canonical workbook

## Review boundary

The workflow stays review-first.

It allows draft row preparation and weekly report generation, but it does not allow silent approval, baseline restatement, or historical ledger rewrites.

## Rollback

- `git revert <sha>`
