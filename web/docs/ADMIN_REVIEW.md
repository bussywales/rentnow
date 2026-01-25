# Admin Review Desk

- Route: `/admin/review` (admin-only).
- Statuses:
  - Only enum-valid values exist: `draft`, `pending`, `live`, `rejected`, `paused`.
  - `pending` listings (or any with `submitted_at` set and not approved/rejected) appear in the desk.
  - Approve → `live` + `is_approved=true` (+ `approved_at`) + `is_active=true`.
  - Request changes keeps the enum-safe status (typically `draft`/`pending`), sets `rejection_reason`, and leaves `is_approved=false` / `approved_at=null`.
- Actions:
  - Approve listing (one at a time) from the drawer.
  - Request changes uses a structured rubric of reasons (location, pin, photos, cover, video, copy, pricing). Admin can add/edit the message or regenerate from reasons. At least one reason or a non-empty message is required.
  - Payload stored as JSON in `rejection_reason`:
    ```json
    {
      "type": "admin_review_request_changes",
      "reasons": ["needs_location", "needs_cover"],
      "message": "Please clarify the area and set a cover.",
      "reviewed_at": "<ISO>",
      "reviewed_by": "<admin user id>"
    }
    ```
    Legacy plain-text values are still parsed as message-only.
- Notes:
  - No tenant surfaces are affected.
  - Review events currently reuse `rejection_reason`; append-only logs can be added later if needed.
  - Drawer updates the list locally and removes processed items from the pending view.
- Saved views & filters:
  - Views: `pending` (default), `changes requested`, `approved (recent)`, `all` – stored in URL and remembered per admin in localStorage.
  - Filters/search/sort: search by title/host/location, toggle has video, needs location/photos, sort oldest/newest; reset returns to defaults.
  - Drawer prev/next navigation follows the currently visible (filtered) list; a hidden-by-filters notice can clear filters and snap to the selected item.
- Host experience:
  - When a rejection reason exists (structured or legacy) and the listing isn’t approved, hosts see a “Fix requested” panel in the editor showing the admin reasons/message and deep links to Photos/Location/Details. Dismissal is session-only and keyed to the payload; legacy plain-text rejection reasons still display as message-only.
  - Hosts can “Resubmit for approval” after fixing items; resubmit returns the listing to `pending` and hides the fix panel locally.
- Caching / freshness:
  - `/admin` and `/admin/review` are forced dynamic (`dynamic="force-dynamic"`, `revalidate=0`, `fetchCache="force-no-store"`); Supabase queries must not be cached so pending/resubmitted items appear immediately.
  - Any new admin data loaders should reuse the `admin-review-queue` status helpers and avoid fetch caching.
- Source of truth (reviewable predicate):
  - A listing is reviewable/pending if `(status in pending set OR submitted_at is not null)` AND `is_approved=false` AND `approved_at is null` AND `rejected_at is null`. `is_active` can be true while pending.
  - Helpers in `admin-review-queue` are the single source; both `/admin` badge and `/admin/review` use the same union helper (service role when available) and sanitize status sets to the enum (`draft`, `pending`, `live`, `rejected`, `paused`).
- Lifecycle:
  - pending → admin approves (live) or requests changes (stores rejection_reason; status remains enum-safe)
  - fix requested → host resubmits → pending (returns to admin review desk)
  - pending items appear in the admin Review desk Pending view; approved/rejected behavior unchanged.
  - Pending source of truth: statuses considered pending for the Review Desk and /admin badge are defined in `admin-review-queue` and sanitized to enum values; submitted listings also qualify via `submitted_at`.
- Troubleshooting when Pending looks empty:
  - Use `GET /api/admin/review/diagnostics` (admin-only, no-store) to inspect: viewer role, SUPABASE project host, pending status set used, counts, and whether a service-role check sees rows blocked by RLS.
  - Diagnostics also exposes grouped status/is_active counts (last 50), optional `?id=<property_id>` to inspect raw status/approval flags, and a raw PostgREST ping (service-role headers) to catch schema/url mismatches; schema is pinned to `public` for the admin client.
  - If the service role key is missing, `/admin/review` shows a warning; configure `SUPABASE_SERVICE_ROLE_KEY` in server env to avoid RLS hiding the queue.
  - Confirm the property `status` matches one of the enum statuses (`draft`, `pending`, `live`, `rejected`, `paused`). Queue helpers sanitize any requested status set to avoid PostgREST 22P02 errors; diagnostics expose `pendingSetRequested`, `pendingSetSanitized`, and `droppedStatuses` when invalid values are passed.
  - If badge > 0 but list is empty, verify filters/search and that the page is not cached; refresh relies on the forced dynamic settings above.
  - Service-role fetch uses a normalized Supabase URL (adds https:// when absent) and schema pinning; if the service fetch fails or returns 404, UI falls back to user-scoped fetch and shows a warning with a link to diagnostics.
