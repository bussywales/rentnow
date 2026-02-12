# Alerts v1 (Saved Search Email Digests)

Alerts v1 sends email digests for active saved searches using Resend.

## How it works

1. The runner loads saved searches where:
   - `is_active = true`
   - `alerts_enabled = true`
   - cadence is due (`instant`, `daily`, or `weekly`)
2. For each saved search, matches are computed from existing saved-search filters.
3. Baseline for “new matches” is:
   - `alert_last_sent_at` if present
   - else `alert_baseline_at` if present
   - else `created_at`
   - else fallback to last 7 days
4. Matching searches are grouped per user into one email digest:
   - Subject: `New matches on PropatyHub`
   - Sections per saved search: title, new count, top listings, view link, disable link
5. On success:
   - one `saved_search_alerts` row is written per `(user, saved_search)` send
   - `saved_searches.alert_last_sent_at` is updated

## Idempotency and dedupe

- The job uses a deterministic dedupe key per:
  - `user_id + saved_search_id + UTC day (YYYY-MM-DD)`
- Re-running the job on the same day will skip duplicate sends for that search.

## Enable/disable controls

- App setting key: `alerts_email_enabled` (default off)
- Environment override: `ALERTS_EMAIL_ENABLED=true` (forces on)
- Per-search controls in Saved Searches UI:
  - `alerts_enabled`
  - `alert_frequency`

## Operational route

- Route: `POST /api/admin/alerts/run`
- Auth:
  - admin session, or
  - `x-cron-secret` header matching `CRON_SECRET`
- Response includes:
  - `users_processed`
  - `emails_sent`
  - processing/skipped/duplicate counters

## Environment variables

- `RESEND_API_KEY` (required for email delivery)
- `RESEND_FROM` (optional sender, defaults to `PropatyHub <no-reply@propatyhub.com>`)
- `CRON_SECRET` (recommended for cron access)
- `ALERTS_EMAIL_ENABLED=true` (optional override)

## Manual trigger example

```bash
curl -X POST "https://www.propatyhub.com/api/admin/alerts/run" \
  -H "x-cron-secret: $CRON_SECRET"
```

## Notes

- Email content is marketplace-safe and links back to `/properties` and `/saved-searches`.
- Unsubscribe is per-search via signed disable link in each digest section.
