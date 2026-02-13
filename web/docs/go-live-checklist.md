# PropatyHub Go-Live Checklist (Internal)

One-page launch runbook for Vercel + Supabase releases.

## 1) Purpose + release owner checklist

- Release owner:
- Target commit/tag:
- Deployment environment:
- Launch window (UTC):
- Go/no-go approver:

Before go-live:

- Confirm `npm run lint`, `npm test`, `npm run build` pass on the release commit.
- Confirm admin access to `/admin/system`, `/admin/alerts`, `/admin/payments`.
- Confirm one tenant and one host/agent smoke account are available.

## 2) Required Vercel env vars

Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Auth/session:

- `NEXT_PUBLIC_SITE_URL` (or equivalent canonical site URL)
- Any auth callback URLs used by the environment

Email (Resend):

- `RESEND_API_KEY`
- `RESEND_FROM` (recommended)

Cron/jobs:

- `CRON_SECRET`

Payments (Paystack):

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY` (if checkout flow needs it)
- `PAYSTACK_WEBHOOK_SECRET` (recommended)

Flags/settings controls:

- `ALERTS_EMAIL_ENABLED` (optional override)
- `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` or `VERCEL_GIT_COMMIT_SHA` (optional, shown in admin system health)

## 3) Supabase migrations checklist

- Compare latest migration in repo (`/web/supabase/migrations`) with production migration history in Supabase dashboard.
- Ensure latest payment ops migrations exist in production, including:
  - `payments` / `featured_purchases`
  - `payment_webhook_events`
  - `receipt_sent_at` on `payments`

If drift is found:

1. Pause launch.
2. Apply missing migrations in order.
3. Re-run smoke tests before resuming launch.

## 4) Cron/jobs checklist

Payments reconcile (Vercel cron target):

- `POST /api/jobs/payments/reconcile`
- Header: `x-cron-secret: <CRON_SECRET>`
- Confirm job returns summary JSON and does not error.

Alerts runner:

- `POST /api/admin/alerts/run` (admin session or cron secret if configured)
- Test email path explicitly with Resend:
  - `POST /api/admin/alerts/test`

## 5) Smoke tests

Logged-out:

- `/`, `/properties`, `/collections/[shareId]`, `/agents/[slug]` load without auth errors.

Tenant:

- Lands on `/tenant/home`.
- Saved searches page works and can follow/search.

Host/Agent:

- Lands on `/home`.
- `/host` loads listings.
- Featured/payment status cards render.

Admin:

- `/admin/system` shows env status + settings snapshot.
- `/admin/alerts` and `/admin/payments` load without crashes.
- Payments reconcile actions return valid summaries.

## 6) Safe launch toggles

Use `/admin/settings` as primary safety controls:

- `alerts_email_enabled`
- `alerts_kill_switch_enabled`
- `featured_requests_enabled`
- `featured_listings_enabled`
- `verification_require_email`
- `verification_require_phone`
- `verification_require_bank`
- `default_market_country`
- `default_market_currency`
- `market_auto_detect_enabled`
- `market_selector_enabled`

## 7) Rollback plan

If launch issues occur:

1. Disable risky systems first (toggle-based):
   - Enable `alerts_kill_switch_enabled`
   - Disable `featured_requests_enabled` and/or `featured_listings_enabled`
2. Revert to last stable Vercel deployment.
3. Validate stability:
   - `/admin/system` reflects expected env/settings
   - `/admin/alerts` and `/admin/payments` stop erroring
4. Open incident note with request IDs, affected routes, and timeline.

## 8) Incident triage quick steps

Start here:

- `/admin/system` (env + setting readiness)
- `/admin/alerts` (alert run state and failures)
- `/admin/payments` (stuck payments, receipts pending, webhook events)

Then:

- Check Vercel function logs for failing route handlers.
- Check Supabase logs/query errors for RLS or missing column issues.
- Check webhook event rows for invalid signatures or processing errors.

Payments note:

- Paystack live verification can be deferred during controlled rollout.
- Keep payments reconcile enabled for reliability.
- If needed, pause payment activation by disabling featured request flow via settings until payment paths are verified.
