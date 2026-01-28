# Admin Review Queue Runbook (5-minute triage)

## How the queue is fetched (now view-only)
1) Queue phase: fetch from `public.admin_review_view` using `ADMIN_REVIEW_QUEUE_SELECT` (service role preferred, user fallback).  
2) No secondary media query for the list; the view supplies `photo_count`, `has_cover`, `cover_image_url`, `has_video`, `video_count`.  
3) Drawer can fetch richer media if needed, but the queue/list is view-only.

## Selecting a listing (details panel)
- Click any row in the left list; URL stores `?id=<uuid>` so refresh preserves selection.
- Drawer fetches details/media via `/api/admin/review/:id` using contract selects and guards; failures show an in-drawer error banner and diagnostics link.
- If selection is hidden by filters, a banner offers “show hidden” to reset filters and snap to that listing.
- `/admin` embeds the same drawer via `AdminReviewShell` inside a client-only boundary; if the drawer fails to load, a fallback message appears but the page stays up. Use the diagnostics link or open `/admin/review` to continue reviewing.
- If you see `column admin_review_view.price does not exist` (or similar):
  1) Apply migration `20260127132459_admin_review_view.sql` in Supabase (or run the SQL in `docs/db/admin_review_view.sql`).  
  2) Re-run `/api/admin/review/diagnostics` and confirm `adminReviewViewColumns` includes the pricing fields and `adminReviewViewHasPricingFields=true`.  
  3) Refresh `/admin` and `/admin/review`; the “DB view is out of date” banner should disappear.

## Source-of-truth select contracts
- Table: `public.admin_review_view`
- `ADMIN_REVIEW_QUEUE_SELECT` (normalized):  
  `id,status,updated_at,submitted_at,is_approved,approved_at,rejected_at,is_active,owner_id,title,city,state_region,country_code,admin_area_1,admin_area_2,postal_code,latitude,longitude,location_label,location_place_id,created_at,rejection_reason,photo_count,has_cover,cover_image_url,has_video,video_count`
- Forbidden: `photo_count/has_cover/cover_image_url` **may only come from the view**, never from `properties`.

## Where to look when it breaks
- Endpoint: `/api/admin/review/diagnostics`
- Fields to read:
  - `serviceOk`, `serviceStatus`, `serviceError`, `serviceErrorDetails`
  - `pendingSetRequested`, `pendingSetSanitized`, `droppedStatuses`
  - `userCount`, `serviceCount`, `source`
- If `serviceOk=false`: treat as error (page should show error panel, not empty list).

## Fast triage checklist (≤5 minutes)
1. Open `/api/admin/review/diagnostics`.  
2. Check `serviceOk`. If false → capture `serviceStatus`/`serviceError`.  
3. Compare `serviceCount` vs `userCount`; if service > 0 & user 0 → RLS/env issue.  
4. Inspect `droppedStatuses` and `pendingSetSanitized` for enum mismatch (22P02 risk).  
5. Search recent commits for changes to `ADMIN_REVIEW_*_SELECT` / allowlists / view SQL.  
6. Verify env has `SUPABASE_SERVICE_ROLE_KEY` in prod.  
7. Run `npm test -- admin-review-contracts` (or full test suite) to catch phantom columns.  
8. If 42703/22P02 → fix view or contract; redeploy.  
9. Re-check diagnostics.  
10. Confirm `/admin` badge count matches `/admin/review?view=pending`.

## Common failures
| Symptom | Likely cause | Fix |
| --- | --- | --- |
| 42703 missing column | Drift from view contract | Use view + contract constants; update allowlist |
| 22P02 enum error | Invalid status in pending set | Sanitize statuses; keep to enum |
| `serviceOk=false`, `serviceCount>0`, `userCount=0` | RLS masking user client | Ensure service role env present; use service branch |
| Empty UI + `serviceOk=false` | Service fetch failed but fell back | Surface error panel; fix service branch |

## How to validate in prod
- Hit `/api/admin/review/diagnostics` and ensure `serviceOk=true`, `serviceStatus=200`, `pendingSetSanitized=["pending"]`, source is `service`.
- Load `/admin/review?view=pending`; verify list count matches diagnostics `serviceCount` (or user count when service missing).
- Approve/request changes on a pending item; ensure it disappears from list and badge decrements.
- Run the contract tests locally: `npm test -- admin-review-contracts`.

## Runbook quick fix path
1) Check `/api/admin/review/diagnostics` → `serviceOk=true`.  
2) Click a row in `/admin` or `/admin/review`; confirm URL gets `?id=`.  
3) If drawer shows error, use diagnostics link and copy debug JSON from error boundary.  
4) Verify contract strings (`admin-review-contracts.ts`) + allowlist tests.  
5) Ensure `/api/admin/review/:id` returns data for selected id (service role env present).  
