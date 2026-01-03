# QA Checklist

## Plan limits (landlord/agent)
- Create listings until the Free plan cap is reached; confirm the New Listing button is disabled.
- Attempt to submit a new listing when at the cap; expect API response with `code=plan_limit_reached`.
- Upgrade CTA is visible and clear when the limit is reached.

## Admin overrides
- In Admin → Users, change a user plan tier and save.
- Set a Max listings override and save (positive integer).
- Confirm the user can publish up to the new limit and events are logged.

## Manual billing
- Set `valid_until` in Admin → Users and confirm listing limits re-apply after expiry.
- Add billing notes and confirm they persist (admin-only).
- Verify manual plan changes survive refresh and are enforced server-side.

## Stripe subscriptions
- Start a Stripe checkout as landlord/agent and confirm redirect to Checkout.
- Complete checkout (test mode) and verify `profile_plans` updates with Stripe IDs and `valid_until`.
- Trigger a cancellation and confirm access downgrades immediately.
- Visit `/dashboard/billing` and confirm plan tier, billing source, status, and valid_until render.
- Replay a webhook event (duplicate) and confirm no double-apply occurs.
- Confirm `stripe_status` changes surface in billing UI (past_due/unpaid/canceled).
- In `/admin/settings/billing`, toggle Stripe mode and confirm `/api/debug/env` shows the current mode and key presence.
- Confirm the Payments mode badge shows TEST/LIVE on `/dashboard/billing`, `/admin/billing`, and `/admin/settings/billing`.
- Set Paystack/Flutterwave keys in `/admin/settings/billing`, save, and confirm they show as “Saved” (masked).

## Upgrade requests
- As a landlord/agent hitting the limit, click “Request upgrade”.
- Confirm the request appears in Admin → Control panel and can be approved/rejected.

## Billing UX polish
- Confirm the Plans & Billing hub shows pricing, usage indicators, and clear CTAs.

## Admin billing ops
- Open `/admin/billing` and search for a known user email.
- Confirm the billing snapshot renders with masked Stripe IDs and valid_until status.
- Use the filter tabs (Pending/Manual/Stripe/Expired/Needs attention) and confirm results change.
- Extend valid_until by 30 days and confirm it updates (manual override).
- Expire now and confirm the user is marked expired.
- Add billing notes and confirm they persist.
- Review Stripe webhook events list; ensure IDs are masked and status/reason render.
- Switch mode filter between test/live and confirm event rows update.
- Replay a failed event and confirm the row updates without duplicating plan changes.
- Use “Copy support snapshot” and “Copy events” to confirm masked output for tickets.

## Tenant premium & alerts
- As a free tenant, save up to the limit and confirm `plan_limit_reached` is returned on the next save.
- As Tenant Pro, confirm unlimited saved searches and “Alerts enabled” badge in the dashboard.
- Approve a new listing and confirm a saved search alert row is created (email sends if Resend is configured).
- Free tenant sees the “Upgrade for instant alerts” prompt on browse.
