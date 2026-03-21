---
title: Codex automation architecture
date: 2026-03-21
audiences:
  - ADMIN
areas:
  - docs
  - ops
  - automation
---

- Added the canonical Codex operating model at `docs/product/CODEX_AUTOMATION_ARCHITECTURE.md`.
- Added a shorter fast-reference companion at `docs/product/CODEX_AUTOMATION_OPERATING_SUMMARY.md`.
- The new docs define the named specialist agents, their schedules, inputs, outputs, review rules, and allowed-touch boundaries.
- They also make the control model explicit for future chats: low-risk docs and ops hygiene can be automated, but payments cutover, entitlements, destructive actions, and other risky changes remain human-controlled.
- Future chats should use these docs as the source of truth for deciding which agent owns a task and whether it is report-only, review-required, or blocked pending approval.
- Rollback: `git revert <sha>`
