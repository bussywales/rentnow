---
title: "Payments Guardian Follow-up"
audiences:
  - ADMIN
areas:
  - payments
  - billing
  - ops
published_at: "2026-03-21"
source_ref: "docs/product/PAYMENTS_GUARDIAN_V1.md"
---

# Payments Guardian Follow-up

We patched the accepted Payments Guardian follow-up items that were safe to resolve immediately.

## What docs were patched

- `web/docs/payments-v1-paystack.md`
- `web/docs/payments-v1-ops-vercel-cron.md`
- `web/docs/BILLING.md`

The Paystack operator docs now reflect the provider-settings-first runtime model, explicit env fallback behaviour, and the current webhook/reconcile cutover reality.

## Webhook finding

- confirmed in part

What was confirmed:

- the Paystack webhook routes were not consistently using the resolved webhook secret source for signature validation

What was fixed now:

- Paystack webhook signature validation now uses the resolved `webhookSecret` path

What remains deferred:

- ingress simplification is still a follow-up review item because the repo still contains two Paystack webhook entry points with different lane responsibilities

## Flutterwave UI finding

- confirmed

What was fixed now:

- Flutterwave remains configured in the codebase, but it is now hidden from self-serve subscription checkout while it stays out of the initial live scope

## Rollback

- `git revert <sha>`
