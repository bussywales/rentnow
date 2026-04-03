# Billing Support Triage Matrix

## Paid but still free
- Most likely causes:
  - manual override masking provider truth
  - ignored Stripe event
  - wrong account loaded
- Check:
  - billing source
  - recent Stripe events
  - provider truth panel
  - identity match between email/profile and Stripe ids
- Preferred action:
  - if manual + stored Stripe truth, use `Return to Stripe billing`
  - if ignored event and cause fixed, replay the Stripe event

## Wrong billing source
- If `manual` but user should be Stripe-backed:
  - confirm manual override masking stored Stripe truth
  - use `Return to Stripe billing`
- If already `stripe`:
  - confirm lifecycle state and provider truth alignment before changing anything

## Manual override masking provider truth
- Signal:
  - admin diagnostics explicitly say manual override is masking provider-owned Stripe state
- Action:
  - confirm correct account identity
  - use `Return to Stripe billing`
  - refresh and verify final state

## Ignored webhook / `missing_plan_mapping`
- Signal:
  - recent Stripe event shows `ignored` with `missing_plan_mapping`
- Action:
  - fix mapping or canonical provider reference issue first
  - replay the exact event afterward

## Identity mismatch
- Signal:
  - loaded account does not match billing-owning Stripe profile
- Action:
  - stop
  - identify the correct profile
  - recover the billing-owning account only

## Wrong account used
- Signal:
  - user login, admin user drawer, and Stripe evidence do not resolve to the same profile
- Action:
  - use email/profile lookup again
  - confirm with full UUID and Stripe ids
  - do not mutate the wrong row

## Duplicate subscription risk
- Signal:
  - multiple active or recent provider subscriptions for the same user
- Action:
  - inspect `subscriptions`
  - inspect Stripe dashboard
  - do not reset or recover blindly until duplicate risk is understood

## Failed payment vs successful checkout confusion
- Signal:
  - customer reports being charged but app is stale
- Action:
  - inspect Stripe checkout/session/subscription evidence first
  - inspect webhook status next
  - do not assume payment failure just because the UI is stale

## Test-account reset eligibility
- Eligible only when:
  - account is a designated internal test account
  - no active provider subscription blocks reset
- Not eligible for:
  - normal live customer accounts
  - `.test` accounts with active Stripe subscriptions still attached

## Portal / manage subscription problems
- Signal:
  - paid user cannot open `Manage subscription`
- Check:
  - account is Stripe-backed
  - Stripe customer id present
  - Stripe subscription id present
  - lifecycle is portal-eligible
- Action:
  - verify billing page lifecycle state
  - verify the account is not manual/free/non-Stripe
  - use admin recovery only if portal ineligibility is caused by stale billing ownership
