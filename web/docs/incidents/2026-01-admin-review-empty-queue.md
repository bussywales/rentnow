# Incident: Admin review empty queue (January 2026)

## Timeline
- 2026-01-10: Admin badge showed pending listings; Review Desk occasionally empty.
- 2026-01-24: Diagnostics hardened with lean select (still healthy).
- 2026-01-26: 400/42703 errors traced to phantom columns in Review Desk select; fix deployed.
- 2026-01-27: Moved queue reads to DB view `public.admin_review_view`; contracts and guards added.

## Symptoms
- `/admin/review?view=pending` rendered empty while `/admin` badge showed pending.
- PostgREST returned 42703 (missing column) for queue select; UI fell back to empty state.
- Diagnostics reported `serviceOk=true`, masking the failure.

## Root Cause
- Review Desk selected phantom/derived columns (`photo_count`, `has_cover`) directly from `properties`, causing PostgREST 42703.
- Contract drift: diagnostics used a lean select; page used an extended select; badge used another path.

## Fix
- Introduced DB view `public.admin_review_view` with only contract-approved columns and computed media counts.
- Centralized selects in contract constants; added forbidden-field guard.
- Unified diagnostics/page/badge on the same view/select; explicit error panel on service fetch failure.

## Prevention
- Contract tests block forbidden/phantom columns and enforce expected select shape and view table.
- Schema allowlist + runtime guard before service-role queries.
- CI runs lint, typecheck, tests, build, and Playwright.
- Runbook and error panel direct ops to diagnostics quickly.
