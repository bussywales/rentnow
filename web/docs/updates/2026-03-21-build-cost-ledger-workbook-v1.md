---
title: "Build Cost Ledger Workbook v1"
audiences:
  - ADMIN
areas:
  - docs
  - ops
  - finance
  - valuation
published_at: "2026-03-21"
source_ref: "docs/product/BUILD_COST_LEDGER_SPEC.md"
---

# Build Cost Ledger Workbook v1

We created the starter workbook for the PropatyHub build-cost valuation system.

## What was added

- the initial ledger workbook at `output/spreadsheet/build-cost-ledger-v1.xlsx`
- the six operating tabs defined in the ledger spec:
  - `Assumptions`
  - `Baseline Valuation`
  - `Weekly Increments`
  - `Cumulative Totals`
  - `Workstream Log`
  - `Notes & Confidence`
- seeded baseline valuation rows and continuation ranges from the documented valuation model
- cumulative formulas so future approved weekly additions roll into the running totals

## What the workbook is for

This workbook is the working ledger for the build-cost valuation model.

It is designed to hold:

- the baseline valuation snapshot
- reviewed weekly valuation additions
- cumulative totals by lens
- confidence and notes for later stakeholder review

It is not an accounting ledger and it is not a market valuation.

## How future weekly updates should use it

- review shipped work since the previous successful run
- classify the work into the documented workstreams
- estimate person-days and added cost by valuation lens
- keep new weekly rows in `draft` until reviewed
- approve only reviewed rows so cumulative totals update intentionally

## Rollback

- `git revert <sha>`
