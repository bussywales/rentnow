---
title: "CI & Release Health Agent v1"
audiences:
  - ADMIN
areas:
  - ops
  - automation
  - testing
  - release
published_at: "2026-03-21"
source_ref: "docs/product/CI_RELEASE_HEALTH_AGENT_V1.md"
---

# CI & Release Health Agent v1

We added the second practical Codex automation workflow for PropatyHub.

## What was added

- a canonical operating spec for CI & Release Health Agent v1
- a standard daily release-health report template
- rollout-plan linkage so future chats and operators know how to run and review it

## What the agent does

The agent reviews recent failed workflow runs, release-gate outcomes, and recent shipped changes to produce one daily review brief.

It can:

- classify important failures as real regression, flaky, infra/config, or release-gate blocker
- rank severity from `S1` to `S4`
- identify likely owner areas and stabilization targets
- highlight recent shipped changes that matter for operators or release owners

It does not merge code, rerun jobs as policy, or change workflows autonomously.

## How it should be used

- run it on a weekday cadence and after important merges
- treat the output as a release-health review queue
- use the report to decide whether to open a stabilization batch, docs follow-up, or operator config fix

## Rollback

- `git revert <sha>`
