---
title: "Docs & Help Drift Agent v1"
audiences:
  - ADMIN
areas:
  - docs
  - help
  - automation
  - ops
published_at: "2026-03-21"
source_ref: "docs/product/DOCS_HELP_DRIFT_AGENT_V1.md"
---

# Docs & Help Drift Agent v1

We added the first practical Codex automation workflow for PropatyHub.

## What was added

- a canonical operating spec for Docs & Help Drift Agent v1
- a standard daily drift-report template
- rollout-plan linkage so future chats and operators know how to run and review it

## What the agent does

The agent reviews recent shipped changes, update notes, and durable docs/help files to detect likely documentation drift.

It can:

- produce a daily review report
- flag likely gaps by severity and audience
- propose safe patch targets
- draft docs-only patch text when the repo truth is clear

It does not merge changes or make autonomous product claims.

## How it should be used

- run it on a weekday cadence and after relevant merges
- treat the output as a review queue
- use the report to decide whether to ship a narrow docs-only patch or escalate for human review

## Rollback

- `git revert <sha>`
