---
title: "Provision reusable internal billing smoke test accounts"
audiences:
  - ADMIN
areas:
  - Billing
  - Support
cta_href: "/admin/billing"
published_at: "2026-04-02"
---

## What changed
- Added `npm run billing:test-accounts:create` to provision the six reusable UK subscription smoke accounts.
- The command uses Supabase service-role auth and requires `BILLING_TEST_ACCOUNT_DEFAULT_PASSWORD`.
- Missing accounts are created as confirmed auth users, assigned the correct role, and marked onboarding-complete.
- Fresh/default `profile_plans` rows are normalized to a free expired-manual baseline so the accounts are immediately reusable for billing smoke tests.

## Operator effect
- Existing test accounts are reused instead of duplicated.
- Existing non-baseline billing state is preserved. For reused accounts with prior billing state, operators should use the billing test-account reset path separately.
- The provisioned `.test` accounts are immediately recognized by the billing test-account guard.

## Required operator input
- Export `BILLING_TEST_ACCOUNT_DEFAULT_PASSWORD` before running the command.
- Keep the password out of committed files. The command reads it from the environment only.
