# QA Checklist

## Plan limits (landlord/agent)
- Create listings until the Free plan cap is reached; confirm the New Listing button is disabled.
- Attempt to submit a new listing when at the cap; expect API response with `code=plan_limit_reached`.
- Upgrade CTA is visible and clear when the limit is reached.

## Admin overrides
- In Admin → Users, change a user plan tier and save.
- Set a Max listings override and save (positive integer).
- Confirm the user can publish up to the new limit and events are logged.

## Admin role management
- In Admin → Users, change a user role and supply a reason.
- Confirm the role badge updates and the user sees the correct dashboard links.
- Verify a role change audit row exists in `role_change_audit`.

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
- Start a Paystack test checkout and confirm redirect to Paystack (test mode).
- Return from Paystack and confirm verification updates `profile_plans` with `billing_source=paystack`.
- Start a Flutterwave test checkout and confirm redirect to Flutterwave (test mode).
- Return from Flutterwave and confirm verification updates `profile_plans` with `billing_source=flutterwave`.
- In `/admin/billing`, confirm provider payment events appear with masked references and status.

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
- As a free tenant, save up to the limit and confirm `limit_reached` is returned on the next save.
- As Tenant Pro, confirm unlimited saved searches and “Alerts enabled” badge in the dashboard.
- Approve a new listing and confirm a saved search alert row is created (email sends if Resend is configured).
- Free tenant sees the “Upgrade for instant alerts” prompt on browse.
- Saved-search create/update/delete returns `role_not_allowed` for non-tenant roles.

## Saved searches UX
- Tenant sees “Saved searches” in the dashboard navigation and can open `/dashboard/saved-searches`.
- Non-tenants do not see the nav item and get a friendly message if they visit the URL directly.

## Discovery & detail UX
- Browse cards show location, price cadence, beds/baths, and furnished status consistently.
- Empty browse results include Clear filters, Browse all, and (tenant-only) Saved searches CTAs.
- Property detail shows a Back to results link when opened from Browse and a clean placeholder when no photos exist.
- Price formatting shows currency symbol when known (e.g. ₦/£), otherwise ISO code, and includes / month or / year for long-term listings.

## Listing stepper beta verification
- Logged-in user can go Basics → Details → Photos without a login prompt.
- Hard refresh on Photos step while logged-in stays authenticated.
- Direct open Photos step URL in a new tab while logged-in stays authenticated.
- Logged-out user opening Photos step is redirected to `/auth/login?reason=auth&next=...`.
- Expired session mid-flow shows a friendly login CTA (no raw errors).

## Country code backfill verification
- Apply `041_backfill_properties_country_code.sql` in Supabase SQL editor.
- Run the backfill coverage query and confirm missing_country_code trends down.
- Create or edit a listing and confirm `country_code` is written alongside `country`.

## Admin data quality checks
- Open `/admin/support` and confirm the Data quality panel renders.
- Verify counts for missing country codes, deposit mismatches, and size mismatches are visible.
- If missing photos is supported, confirm the count is non-null and sample rows render.
- SQL coverage checks:
- `select count(*) from public.properties where country is not null and country_code is null;`
- `select count(*) from public.properties where deposit_amount is not null and deposit_currency is null;`
- `select count(*) from public.properties where size_value is not null and size_unit is null;`
- `select count(*) from public.properties p left join public.property_images pi on pi.property_id = p.id where pi.id is null;`

## Role-aware CTAs
- Landing CTA shows “List a property” for unauthenticated users (redirects to login).
- Landing CTA shows “Find a home” for tenants and “List a property” for landlords/agents.
- Tenants receive `role_not_allowed` when attempting to create/update/delete listings.

## Messaging throttle telemetry
- Trigger rate limiting with rapid sends and confirm the cooldown UI appears.
- Verify a row appears in `public.messaging_throttle_events` for the rate-limited attempt.
- Open `/admin/support` and confirm throttle telemetry counts and top senders render.

## PWA foundation
- Confirm install prompt appears in the browser (or install button in DevTools).
- Confirm the service worker registers and is active.
- Go offline and refresh a public route; `/offline` should render.
- Confirm `/api/*`, `/dashboard/*`, `/admin/*`, `/auth/*` are not cached.

## PWA push alerts
- With VAPID keys configured, confirm the Push badge shows status on `/dashboard/saved-searches`.
- Enable notifications and verify a row exists in `public.push_subscriptions`.
- Trigger a saved search alert and confirm a push notification is delivered.
- In `/admin/support`, confirm push subscription counts and alert sample metrics render.
- If a push attempt fails, confirm `saved_search_alerts.error` includes a `push_unavailable:` or `push_failed:` marker.
- If a push attempt returns a permanent failure (404/410), confirm the subscription row is removed and `saved_search_alerts.error` includes `push_pruned:gone`.
- Run `select public.cleanup_push_alerts(60)` in the SQL editor and confirm old push alert rows are pruned.
