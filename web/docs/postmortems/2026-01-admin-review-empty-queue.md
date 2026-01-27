# Summary
Admin Review Desk (`/admin/review`) silently rendered empty while diagnostics and the admin badge showed pending listings. The page requested non-existent columns, triggering PostgREST 400 errors that were swallowed, causing admins to miss pending listings.

# Impact
- Admin reviewers saw an empty pending queue for multiple hours.
- Approvals/requests for changes were blocked until a manual refresh of the select.
- Trust in the admin surface degraded because diagnostics reported “serviceOk=true” while the page failed.

# Timeline
- 2026-01-10: Admin badge shows pending listings (healthy).
- 2026-01-24: Diagnostics hardened; still used lean select (healthy).
- 2026-01-26 11:20 UTC: Commit 9f4b679 (“Fix admin review queue select”) removes phantom columns after 400s observed.
- 2026-01-26 11:26 UTC: Commit a1cb29f (“Harden admin review detail casting”) stabilizes detail fetch.
- 2026-01-26: Incident resolved; pending listings visible again.

# Root Cause
The Review Desk queried `properties` with phantom columns (`photo_count`, `has_cover`, derived relations) that do not exist in the schema. Supabase/PostgREST returned `42703 column does not exist`, and the fetch handler treated the error as “no rows,” rendering an empty UI.

# Contributing Factors
- Diagnostics endpoint used a different, lean select, so health checks stayed “green.”
- The page swallowed service-role 400s and fell back to an empty array instead of surfacing an error.
- No contract/allowlist to prevent phantom columns from entering the queue select.

# Detection
- Manual observation: `/admin/review?view=pending` empty while `/api/admin/review/diagnostics` reported `serviceOk=true` with pending IDs.
- Console log showed `[AdminReviewDesk] listings.length 0`; network tab showed 400 from PostgREST for the queue select.

# Resolution
- Replaced inline selects with shared contract constants.
- Two-phase fetch: queue IDs only, then detail/media fetch using minimal selects.
- Added runtime error panel when service-role fetch fails.
- Added contract + allowlist tests to fail CI on phantom columns.

# Corrective Actions
- Enforce contract constants for queue/detail/media selects.
- Add schema allowlists and contract tests (no phantom columns).
- Show explicit error UI when service fetch fails instead of empty state.
- Add runbook for 5-minute triage.
- Add CI guard (lint, typecheck, test, build, Playwright) covering the contracts.

# What We’ll Do Differently
- Never embed derived/optional columns in queue selects; compute via secondary fetch or view.
- Keep diagnostics and page selects identical by sharing constants.
- Treat service-role failures as user-facing errors, not empty states.
- Consider a dedicated DB view for admin review counts (future work).

# Appendix: Diagnostics Cheatsheet
- Endpoint: `/api/admin/review/diagnostics`
- Key fields: `serviceOk`, `serviceStatus`, `serviceError`, `pendingSetRequested`, `pendingSetSanitized`, `droppedStatuses`, `userCount`, `serviceCount`
- Quick checks:
  - `serviceOk=false` → service-role fetch failed; page should show error panel.
  - `pendingSetSanitized` missing expected status → status enum mismatch.
  - `serviceCount > 0` & `userCount = 0` → RLS masking; configure service role.
  - `serviceError code 42703` → phantom column; fix contract.
