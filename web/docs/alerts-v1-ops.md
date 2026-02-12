# Alerts v1 Ops Runbook

This guide covers operational controls for saved-search email alerts.

## Control model

- `alerts_email_enabled`:
  - Main feature flag.
  - If `false`, regular runs do not send.
- `alerts_kill_switch_enabled`:
  - Emergency stop.
  - If `true`, all sends are blocked even when env override is on.
- `ALERTS_EMAIL_ENABLED=true`:
  - Environment override that forces feature flag on.
  - Still blocked by kill switch.

## Admin Ops page

Route: `/admin/alerts`

Includes:

- Alerts status card:
  - feature flag status
  - kill switch status
  - env override presence
  - Resend key presence
  - Cron secret presence
- Last run card:
  - UTC run timestamp
  - mode (`admin` or `cron`)
  - users processed
  - digests sent
  - searches included
  - failed users
  - disabled reason (if blocked)
- Actions:
  - **Run alerts now**
  - **Send test digest to me**
  - **Disable all alerts (kill switch)** (sets `alerts_email_enabled` to off)

## Runtime routes

- `POST /api/admin/alerts/run`
  - auth:
    - admin session OR
    - `x-cron-secret` matching `CRON_SECRET`
  - writes `alerts_last_run_status_json` after every execution (including disabled runs)

- `POST /api/admin/alerts/test`
  - auth: admin session only
  - sends a test digest to the logged-in admin email
  - does **not** write `saved_search_alerts`
  - does **not** update `saved_searches.alert_last_sent_at`

## Cron example

```bash
curl -X POST "https://www.propatyhub.com/api/admin/alerts/run" \
  -H "x-cron-secret: $CRON_SECRET"
```

## Required environment variables

- `RESEND_API_KEY`
- `CRON_SECRET` (for cron-triggered run endpoint)

Optional:

- `RESEND_FROM`
- `ALERTS_EMAIL_ENABLED=true`

## Confirm dedupe quickly

1. Run `POST /api/admin/alerts/run`.
2. Run it again same UTC day.
3. Check response counters:
   - duplicates/skipped should increase
   - digests should not duplicate for same search/day key.

