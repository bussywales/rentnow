# Billing Ops Runbook

This runbook is for PropatyHub / RentNow subscription billing incidents.

## 1. Healthy paid account verification
Use `/admin/billing` and load the account by email or profile UUID.

Healthy state means:
- `billing_source = stripe`
- effective plan matches the intended paid tier
- lifecycle state is appropriate for the subscription status
- Stripe customer and subscription identifiers are present
- latest provider subscription row agrees with `profile_plans`
- latest relevant Stripe webhook event is processed or otherwise explained

Verify:
- app UI shows the expected paid plan
- `/admin/billing` shows aligned provider truth
- `subscriptions` contains the active Stripe row
- Stripe dashboard customer and subscription match the account being inspected

## 2. Manual override stuck account recovery
Use when:
- account shows `billing_source = manual`
- stored Stripe truth exists underneath
- the manual state is masking intended provider-owned billing

Steps:
1. Load the account in `/admin/billing`.
2. Confirm stored Stripe truth is present.
3. Confirm you are targeting the right account identity.
4. Enter a reason.
5. Use `Return to Stripe billing`.
6. Refresh the billing snapshot.
7. Confirm final state matches the active Stripe subscription.

Do not use this action when no recoverable Stripe truth is present.

## 3. Replay ignored Stripe event
Use when:
- a Stripe event exists for the loaded account
- outcome is ignored or failed
- the underlying cause has already been fixed

Common replay causes:
- `missing_plan_mapping`
- `manual_override`
- `missing_profile_attach`
- `identity_mismatch`

Steps:
1. Load the account in `/admin/billing`.
2. Read the event reason.
3. Fix the root cause first.
4. Enter a reason.
5. Select the replay-eligible event.
6. Use `Replay Stripe event`.
7. Refresh and verify:
   - event status
   - billing source
   - plan tier
   - provider subscription row

Do not replay before fixing the cause. Replay is not a substitute for diagnosis.

## 4. Billing test-account reset flow
Use only for designated internal `.test` accounts or explicitly allowlisted test emails.

Steps:
1. Load the test account in `/admin/billing`.
2. Confirm the account is designated as a test account.
3. Confirm there is no active provider subscription blocker.
4. Enter a reason.
5. Use `Reset billing test account`.
6. Refresh and confirm:
   - effective plan is free
   - provider linkage on `profile_plans` is cleared
   - historical `subscriptions` and `stripe_webhook_events` remain intact

Reset does not cancel live subscriptions and does not delete revenue history.

## 5. Identity mismatch handling
Signs:
- email and profile UUID resolve to different accounts
- Stripe events reference a different profile than the loaded one
- user says they paid, but the loaded row has no matching Stripe truth

Steps:
1. Confirm the exact account identity first.
2. Compare:
   - loaded profile UUID
   - loaded email
   - Stripe customer id
   - Stripe subscription id
   - webhook profile attachment
3. If the paid account is different from the loaded account, stop.
4. Recover the billing-owning profile, not the guessed one.

Do not run plan-recovery actions against an identity-mismatched account.

## 6. Expired manual override + Stripe takeover expectations
Current intended behavior:
- active manual override still blocks Stripe ownership takeover
- expired manual override no longer blocks valid Stripe subscription takeover

When a valid Stripe event arrives after manual expiry:
- billing ownership should return to Stripe automatically
- the billing notes/timeline should explain the automatic takeover

If that does not happen:
- inspect recent Stripe events
- confirm event reason
- confirm the loaded row is the billing-owning profile

## 7. Checkout succeeds but app state does not update
Treat this as a lifecycle mismatch, not immediately as a payment failure.

Check in order:
1. Did Stripe checkout succeed for the expected customer?
2. Is the correct account loaded in `/admin/billing`?
3. Is there a recent Stripe webhook event?
4. Was it:
   - processed
   - ignored
   - failed
5. If ignored/failed, what was the reason?
6. Is provider truth already stored underneath but masked by manual override?
7. Can a replay safely restore the state after fixing the cause?

## 8. When not to use SQL
Do not use SQL when:
- the account can be recovered through `Return to Stripe billing`
- a replay-eligible Stripe event exists and the cause can be fixed
- the issue is just a stale admin snapshot
- the issue is identity mismatch and the correct account has not been confirmed

Normal operator actions must win over direct row edits whenever possible.

## 9. When SQL is acceptable as a last resort
SQL is last resort only when all of the following are true:
- the exact account identity is proven
- provider truth is proven from Stripe and internal evidence
- normal recovery path cannot safely write the correct state
- the required change is narrow and reversible
- billing notes or incident notes record exactly what was changed

SQL is not acceptable for guesswork, convenience, or compensating for unresolved identity ambiguity.

## 10. Final account truth verification
Before closing the incident, confirm:
- app UI matches the intended billing state
- `billing_source` is correct
- effective plan and provider truth agree
- Stripe identifiers are present if the account is Stripe-backed
- latest relevant webhook evidence is present and understandable
- billing notes/timeline record the operator action taken
