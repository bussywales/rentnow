---
title: Codex automation rollout plan
date: 2026-03-21
audiences:
  - ADMIN
areas:
  - docs
  - ops
  - automation
---

- Added the first-wave Codex rollout plan at `docs/product/CODEX_AUTOMATION_ROLLOUT_PLAN.md`.
- The plan focuses on the first three PropatyHub automations:
  - Payments Guardian
  - Docs & Help Drift Agent
  - CI & Release Health Agent
- It defines their schedules, inputs, outputs, review gates, allowed-touch boundaries, and never-autonomous limits.
- It also recommends the safest activation order for operators: Docs & Help Drift first, then CI & Release Health, then Payments Guardian.
- Future chats should use this plan as the practical rollout and adoption guide for standing up the first automation wave.
- Rollback: `git revert <sha>`
