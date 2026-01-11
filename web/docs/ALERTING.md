# Alerting & Incident Readiness

This doc describes the admin-only alerting signals and how to validate them. Alerts are derived from existing telemetry tables and are read-only.

## Alerts included

- Push failures/unavailable spikes (saved_search_alerts error markers)
- Push configured but zero subscriptions for 24h
- Messaging throttle spikes (messaging_throttle_events)
- Data quality spikes (missing photos, missing metadata counts)

## Thresholds

Thresholds are defined in `lib/admin/alerts-config.ts`:
- Push failures: count + failure rate thresholds (last 1h)
- Push unavailable: count thresholds (last 1h)
- Push subscriptions: warn if configured but zero for 24h
- Messaging throttles: warn (last 1h), critical (last 15m)
- Data quality: warn/info thresholds for missing photos, country_code, deposit currency, size unit, listing type

## How to validate

1) Visit `/admin/alerts` as an admin:
   - Confirm alerts render with severity, window, and recommended actions.
   - Confirm the runbook link anchors to the runbook section.

2) Cross-check metrics in `/admin/support`:
   - Push telemetry (recent push outcomes)
   - Throttle telemetry counts
   - Data quality counts and affected listings table

3) Optional webhook dispatch:
   - Ensure `ALERT_WEBHOOK_URL` is set in the server environment.
   - Call `POST /api/admin/alerts/dispatch` as an admin.
   - Without the env var, the route returns `reason: "disabled"`.

## Webhook payload guarantees (no PII)

- Only includes alert keys, severity, titles, counts, windows, and relative admin paths.
- Excludes names, emails, phone numbers, tokens, or absolute URLs.
- Payload is sanitized to strip absolute URLs and token-like fields.

## “What good looks like”

- Alerts show only when thresholds are exceeded.
- No alert includes PII or absolute URLs.
- Dispatch route is admin-only and uses service role only after guard.
