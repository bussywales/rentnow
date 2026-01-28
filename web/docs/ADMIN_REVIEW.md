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

## Contracts & guardrails
- Source of truth table/view: `public.admin_review_view` (see SQL in `supabase/migrations/*_admin_review_view.sql` and `docs/db/admin_review_view.sql`).
- Queue select (`ADMIN_REVIEW_QUEUE_SELECT`):  
  `id,status,updated_at,submitted_at,is_approved,approved_at,rejected_at,is_active,owner_id,title,city,state_region,country_code,admin_area_1,admin_area_2,postal_code,latitude,longitude,location_label,location_place_id,created_at,rejection_reason,photo_count,has_cover,cover_image_url,has_video,video_count`
- Forbidden in selects: raw relations like `property_images`, `property_videos` (enforced by runtime guard + tests).
- Queue/list fetch is view-only; no secondary media fetch for pending list.
- Error handling: if `serviceAttempted && !serviceOk`, `/admin/review` shows an error panel (not empty). Use `/api/admin/review/diagnostics`.
- Guardrails: schema allowlist + contract tests (`lib/admin/admin-review-schema-allowlist.ts`, `tests/unit/admin-review-contracts.test.ts`).
- Runbook: `docs/runbooks/admin-review-queue.md`. Postmortem: `docs/incidents/2026-01-admin-review-empty-queue.md`.

## Using Review Desk (admins)
- Open `/admin/review`; the first pending listing auto-selects.
- Click any row to select it; the drawer highlights the current row and loads details/media/location via `/api/admin/review/:id`.
- Buttons:
  - **Approve listing** → `status=live`, `is_approved=true`, `approved_at` set, item removed from pending list.
  - **Reject listing** → `status=rejected`, requires reason (textarea), removes from pending list.
  - **Send request** → `status=changes_requested`, stores structured reasons + message, removes from pending list.
- Drawer navigation: Previous/Next follow the currently visible list; a hidden-by-filters notice can reset filters and jump to the selection.
- If service fetch fails (`serviceAttempted && !serviceOk`), the page shows the Service Error panel; no silent empty state.
- `/admin` now embeds the same drawer and queue: clicking a property row opens the shared Review Drawer, using the same contracts, diagnostics, and error boundary. `/admin/review` remains a focused view but shares all logic.
- `/admin` guards against crashes: the review panel is loaded via a client-only boundary with a fallback message that links to diagnostics and `/admin/review`, so the rest of the admin page stays available even when the drawer fails to load.
- Review queue vs Listings:
  - **Overview tab (default)**: counts by status + active/inactive, recent listings, and quick links to Review queue or Listings. URL-driven via `?tab=overview`.
  - **Review queue tab**: only reviewable listings (pending + changes requested). Uses the review queue helper against `admin_review_view`. URL-driven selection `?tab=review&id=<uuid>`.
  - **Listings tab**: all listings (same view/contract) with search + filters (q/qMode, status, active, sort). URL-driven selection `?tab=listings&id=<uuid>`.
- Intended routes:
  - `/dashboard` is the default workspace for all authenticated roles (including admins).
  - `/admin` is the admin console with Overview / Review queue / Listings tabs (`?tab=overview|review|listings`).
  - `/admin/review` remains the focused Review Desk view and shares the drawer/contract.
- Drift detection & remediation:
  - Diagnostics now lists `adminReviewViewColumns`, flags missing pricing fields, and reports `missingExpectedColumns`.
  - Queue fetch falls back to a minimal select if PostgREST returns 42703 (missing column) and marks `contractDegraded=true`.
  - UI surfaces a banner: “Database view is out of date… Apply migration 20260127132459_admin_review_view.sql”.
  - If you see `column admin_review_view.price does not exist`, run the migration in Supabase, then re-check diagnostics (columns should include price/currency/rent_period/rental_type/listing_type/bedrooms/bathrooms).

### How review works (end-to-end)
1) Queue is fetched server-side from `public.admin_review_view` (service role when available).  
2) On select, the client sets `?id=<uuid>` and fetches details/media via `/api/admin/review/:id` using the same contract.  
3) Drawer renders Overview (status/readiness/location), Media (images/videos), Location (city/state/country/coords), Notes (rejection_reason).  
4) Actions call admin APIs:
   - Approve: `/api/admin/properties/[id]/approve`
   - Reject: `/api/admin/properties/[id]` (PATCH action=reject, reason required)
   - Request changes: `/api/admin/properties/[id]/request-changes`
   After success, the item is removed from pending, router refreshed, next item auto-selects.

### Troubleshooting click crash (“Error in input stream”)
- Check console logs from `AdminReviewDesk select click` and `AdminReviewDrawer fetch detail` for id and status.
- If detail fetch fails, an in-drawer error panel appears with a diagnostics link; run `/api/admin/review/diagnostics`.
- Render errors are caught by DrawerErrorBoundary and surfaced with the selected id; retry button re-renders.
- Common causes: invalid media URLs, unexpected nulls; the detail schema now coerces lat/long and guards missing fields.

## Design improvements (safe iterations)
- Stronger list cards: title, location label, submitted time, readiness chips.
- Sticky top filter/search bar.
- Keyboard navigation (j/k, enter to open).
- Drawer hierarchy: Media, Location, Details, Notes, Actions.
- Keep reason checklist + message generator; “Next pending” CTA after approve/request changes.
- Persist view/search in URL + localStorage (already in place; verify per release).
