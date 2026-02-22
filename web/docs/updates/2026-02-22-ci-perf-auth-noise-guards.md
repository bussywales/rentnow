---
title: "CI perf budgets + auth-noise hardening"
audiences:
  - TENANT
  - HOST
  - AGENT
  - ADMIN
areas:
  - CORE
  - SHORTLETS
---

## What changed

- Added CI/local perf guards that prevent regressions in shortlets eager-image loading policy and map clustering threshold configuration.
- Added a deterministic shortlets pipeline runtime budget unit test to catch accidental performance regressions.
- Reduced expected guest auth-noise on public surfaces by suppressing production logging for routine unauthenticated 401 cases while keeping debug/non-production diagnostics available.

## Why this matters

- These updates harden reliability and observability without changing booking, payment, or UI behaviour.
- We preserve clean production logs for actionable issues and lock performance budgets into CI to prevent drift.
