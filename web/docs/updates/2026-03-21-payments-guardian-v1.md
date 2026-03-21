---
title: "Payments Guardian v1"
audiences:
  - ADMIN
areas:
  - ops
  - automation
  - payments
  - billing
published_at: "2026-03-21"
source_ref: "docs/product/PAYMENTS_GUARDIAN_V1.md"
---

# Payments Guardian v1

We added the third practical Codex automation workflow for PropatyHub.

## What was added

- a canonical operating spec for Payments Guardian v1
- a standard daily payment-readiness report template
- rollout-plan linkage so future chats and operators know how to run and review it

## What the agent does

The agent reviews recent payment-related code and doc changes, payment workflow evidence, and cutover assumptions to produce one daily payment-ops brief.

It can:

- review lane-by-lane confidence drift
- classify important findings as code/docs drift, webhook/config ambiguity, reconcile/cutover risk, launch-readiness watch item, or release-gate blocker
- suggest likely owner areas and follow-up batch targets

It does not change payment behavior, routing, secrets, or cutover configuration autonomously.

## How it should be used

- run it on a weekday cadence and before planned payment cutovers
- treat the output as a payment review queue
- use the report to decide whether to open a docs patch, operator config fix, stabilization batch, or product review

## Rollback

- `git revert <sha>`
