---
title: Paystack config source-of-truth unification
date: 2026-03-20
audiences:
  - ADMIN
areas:
  - payments
  - billing
  - ops
---

## What was found

Paystack configuration was split across two different resolution paths:

- billing checkout used provider-settings-aware Paystack config
- webhook, shortlet Paystack, featured Paystack, and reconcile paths still relied on env-only server helpers

That meant checkout could work from stored provider settings while ops or reconcile paths still reported Paystack as unconfigured.

## What was unified

- Paystack runtime, webhook, featured-init, shortlet, and reconcile paths now resolve through one shared provider-settings-aware config helper
- stored provider settings are now the canonical Paystack source of truth
- admin/debug and billing docs were updated to reflect the new precedence

## What fallback remains

Env fallback still remains intentionally for safe rollout and recovery:

1. stored provider settings for the active mode
2. env keys for the active mode
3. single env keys
4. if live mode has no keys, fallback to test mode

For Paystack webhook verification, precedence is:

1. `PAYSTACK_WEBHOOK_SECRET[_TEST|_LIVE]`
2. `PAYSTACK_WEBHOOK_SECRET`
3. resolved Paystack secret key for the effective mode

## Rollback

- `git revert <sha>`
