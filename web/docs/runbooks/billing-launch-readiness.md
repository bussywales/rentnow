# Billing Launch Readiness

This checklist is the go-live gate for PropatyHub / RentNow subscription billing.

## Launch status
- Certified:
  - Tenant monthly
  - Tenant yearly
  - Landlord monthly
  - Agent monthly
- Provisionally accepted:
  - Landlord yearly
  - Agent yearly

## Pricing truth
- Confirm canonical subscription pricing is present in `subscription_price_book`.
- Confirm each UK subscription row is active, current, and linked to the intended Stripe recurring `price_...` reference.
- Confirm admin can view the canonical matrix at `/admin/settings/billing/prices`.
- Confirm no UK row shows:
  - missing provider ref
  - checkout mismatch
  - unsafe fallback

## Stripe refs and runtime wiring
- Confirm the active provider mode in `/admin/settings/billing` matches launch intent.
- Confirm Stripe live secret is configured.
- Confirm billing webhook secret is configured for the billing route.
- Confirm the Stripe checkout route is using canonical UK price-book linkage, not stale fallback refs.
- Confirm webhook price mapping resolves canonical Stripe `price_...` values.

## Webhook readiness
- Confirm Stripe live readiness from `/admin/settings/billing` and `/admin/system`.
- Confirm the billing webhook endpoint is pointed at `/api/billing/stripe/webhook`.
- Confirm recent webhook rows are visible in `/admin/billing`.
- Confirm ignored reasons are understandable and replay-eligible events are operator-visible.

## Smoke readiness
- Confirm the six internal smoke accounts exist:
  - `tenant-monthly-uk-01@rentnow.test`
  - `tenant-yearly-uk-01@rentnow.test`
  - `landlord-monthly-uk-01@rentnow.test`
  - `landlord-yearly-uk-01@rentnow.test`
  - `agent-monthly-uk-01@rentnow.test`
  - `agent-yearly-uk-01@rentnow.test`
- Confirm landlord and agent `.test` accounts have non-empty `phone` and `preferred_contact` values so profile-completeness noise does not interrupt billing smoke.
- Confirm test-account reset is available in `/admin/billing` for designated `.test` accounts with no active provider subscription.

## Admin recovery readiness
- Confirm `/admin/billing` lookup works by email and profile UUID.
- Confirm the loaded snapshot shows:
  - profile UUID
  - role
  - effective plan
  - billing source
  - lifecycle state
  - Stripe identifiers present/missing
  - provider truth alignment
- Confirm the following actions work for eligible cases:
  - Return to Stripe billing
  - Replay Stripe event
  - Reset billing test account
  - Refresh billing snapshot

## Support readiness
- Confirm billing notes append correctly.
- Confirm billing ops timeline shows webhook outcomes, replay attempts, and recovery notes.
- Confirm support can copy a masked support snapshot from `/admin/billing`.
- Confirm the runbook in `web/docs/runbooks/billing-ops-runbook.md` is available to operators.

## Monitoring posture
- Monitor `/admin/billing` for:
  - recent ignored Stripe events
  - `manual_override`
  - `missing_plan_mapping`
  - `missing_profile_attach`
  - `identity_mismatch`
- Monitor for provider mismatch between `profile_plans` and `subscriptions`.
- Watch billing source drift, especially `manual` rows with stored Stripe truth underneath.

## Rollback posture
- Do not rewrite active Stripe recurring prices in place.
- Prefer:
  - switching provider mode back to test if live keys are incomplete
  - disabling risky operator actions by policy, not schema mutation
  - replaying after root cause correction instead of direct row edits
- Use SQL only as a last resort and only after operator paths cannot safely restore provider truth.

## Go-live decision
Launch is ready when all of the following are true:
- UK canonical pricing rows are linked and match checkout truth.
- Certified lanes remain green in smoke and recovery drills.
- Provisional lanes have no unresolved runtime mismatch.
- Billing ops can recover a paid account without another charge.
- Test-account reset and replay flows are working.
- Support can follow the runbook without engineering intervention.
