---
title: "Build Cost Valuation System v1"
audiences:
  - ADMIN
areas:
  - docs
  - ops
  - finance
  - valuation
published_at: "2026-03-21"
source_ref: "docs/product/BUILD_COST_VALUATION_METHOD.md"
---

# Build Cost Valuation System v1

We added a build-cost valuation system for PropatyHub.

## What was added

- a canonical methodology for estimating build cost from repo truth
- a baseline report for the platform from `2025-12-02` to the current state
- a spreadsheet ledger spec for weekly cumulative tracking
- a weekly automation spec for reviewed valuation updates
- a canonical workbook path and tab structure for the future ledger file

## What the valuation system is for

This system is for founder and stakeholder understanding.

It estimates what it would realistically cost an external paid team to build the current platform and to continue extending it.

It is not audited spend and it is not a business valuation.

## What future weekly updates should do

- review shipped work since the previous successful run
- classify it into workstreams
- estimate added effort and cost by lens
- append a reviewed weekly increment to the spreadsheet ledger
- update cumulative totals without silently restating history

## Implementation note

This batch keeps the ledger setup docs-first.

The workbook structure is fully specified at `output/spreadsheet/build-cost-ledger-v1.xlsx`, but the actual spreadsheet artifact is intentionally left for a spreadsheet-enabled follow-up rather than adding a new local dependency in this documentation batch.

## Rollback

- `git revert <sha>`
