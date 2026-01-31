# Admin Ops Console

PropatyHub admin operations are split into clear workspaces with URL-driven state and zero silent failures.

## Routes & purpose
- `/admin` — **Overview cockpit** (monitor-only).
- `/admin/review` — **Review Desk** (decision mode; approve/reject/request changes).
- `/admin/listings` — **Listings Registry** (ops mode; all listings).
- `/admin/listings/[id]` — **Listing Inspector** (read-only deep view).

## Overview cockpit (`/admin`)
- KPI cards: pending review, changes requested, live, draft, rejected, active, inactive.
- Alerts/attention panel (lightweight derived notices).
- Recently updated listings list with links:
  - Reviewable items → `/admin/review?id=<uuid>`
  - Non-reviewable items → `/admin/listings/<uuid>`
- Quick actions: Go to Review queue, Go to Listings.

## Review Desk (`/admin/review`)
- Only reviewable statuses (pending + changes requested).
- Split view: queue list (left) + decision workspace (right).
- Checklist gating: Approve disabled until all checklist sections are **Pass**.
- Actions: Approve, Request changes (required message), Reject (required reason).
- Keyboard shortcuts: `J/K` next/previous, `A` approve, `C` request changes, `R` reject, `Esc` close.

## Listings Registry (`/admin/listings`)
- All listings (not filtered to pending).
- Search modes:
  - **Listing ID** (exact)
  - **Owner ID** (exact)
  - **Title / Location** (partial match)
- Filters:
  - Status (multi)
  - Active / Inactive
  - Missing cover / Missing photos / Missing location
  - Price min / max (simple outlier guardrails)
- Saved views:
  - Save current filters/search as a named view.
  - Apply or delete from the Saved Views dropdown.
- Pagination + sorting:
  - Sort by updated/created (asc/desc).
  - Page + page size controls.
- Row click opens the read-only inspector at `/admin/listings/[id]`.

## Error handling & diagnostics
- Admin review + listings surfaces never silently fail.
- When a fetch fails, a visible error panel links to `/api/admin/review/diagnostics`.
- Copy debug payloads are provided in review drawer error panels.

## Notes for engineers
- Listing queues and registry draw from `public.admin_review_view`.
- Checklist state persists in `admin_review_notes`.
- Templates in `admin_message_templates`, activity in `admin_actions_log`.
- Saved views in `admin_saved_views` (admin-only RLS).
