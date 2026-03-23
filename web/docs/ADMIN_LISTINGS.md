# Admin Listings Registry

- Route: `/admin/listings` (admin-only).
- Purpose: ops-friendly registry of **all** listings (not just reviewable).
- Selection: clicking a row navigates to `/admin/listings/[id]` for inspection and guarded admin lifecycle controls.

## Query params (server-side)
The registry is backed by `GET /api/admin/listings` and the server-side page uses the same query parsing.

- `q` — search text
- `qMode` — `all | id | owner | title`
  - `all` is the default registry mode and powers the main search box
  - `all`: partial match across title and location text, exact match on listing id/owner id for UUID input, plus owner name lookup where profile data is available
  - `id`: exact match on listing id
  - `owner`: exact match on owner id for UUID input, or owner-name lookup via `profiles.full_name`
  - `title`: partial match across title and location text only
- `status` — multi-select status filter (comma-separated or repeated; normalized + deduped)
- `active` — `all | true | false`
- `page` — 1-based page number (default 1)
- `pageSize` — 25/50/100
- `sort` — `updated_desc | updated_asc | created_desc | created_asc | expires_asc | score_desc | score_asc | title_asc | approved_desc`
- `quality` — `all | strong | fair | needs_work`
- `missingItem` — `all | missing_cover | missing_images | missing_description | missing_price | missing_location`
- `missingCover` — `true` to show listings without a cover
- `missingPhotos` — `true` to show listings with photo_count=0
- `missingLocation` — `true` to show listings without location label/coords
- `priceMin` / `priceMax` — numeric price bounds (simple outlier filters)
- `listing_type` — listing type filter (apartment, house, duplex, bungalow, studio, room, student, hostel, shop, office, land)
- `bedroomsMin` / `bedroomsMax` — bedroom range filter
- `bathroomsMin` / `bathroomsMax` — bathroom range filter
- `demo` — `all | true | false`
- `featured` / `expiring` / `expired` — featured lifecycle filters

Example:
```
/admin/listings?q=lagos&status=pending&status=live&quality=needs_work&sort=expires_asc
```

Canonical status param:
```
/admin/listings?status=draft,pending
```

## Saved views
- Saved views are stored per admin user (`admin_saved_views`).
- Use the **Saved views** dropdown on `/admin/listings` to apply or delete.
- Use **Save view** to persist the current search + filter state.

## Demo listings controls

The registry is the admin operations surface for demo flag management.

Use it to:

- filter by demo status with `demo=all|true|false`
- identify demo listings alongside other quality and lifecycle filters
- change the demo flag directly from the row action

State-aware row actions:

- `Set demo`
  - applies the listing’s `is_demo` flag
- `Remove demo`
  - clears the listing’s `is_demo` flag

These row actions change the listing flag itself. They do not control demo visibility policy or badge/watermark presentation.

Those presentation controls live in `/admin/settings`:

- `demo_listings_visibility_policy`
- `demo_badge_enabled`
- `demo_watermark_enabled`

## Listing quality workflow

The registry includes a separate listing-quality layer on top of the base query filters.

Use it to answer:

- which listings are operationally strong enough to leave alone
- which listings need quick intervention before review or growth work
- which exact missing item is blocking a listing from looking complete

### Quality status

Listings with a computed quality score are grouped into:

- `Strong`
- `Fair`
- `Needs work`

Use the quality status control when you want broad triage by listing completeness instead of filtering on one missing field at a time. This filter is URL-backed and applied on the server-side admin view, not just the current page.

### Quality score sorting

The registry supports quality score sorting as a server-backed custom view:

- `Highest score first`
- `Lowest score first`

Use score sorting after narrowing the registry to surface the weakest or strongest records in the current result set. Because quality score is derived from enriched listing data, the page computes this view on the server and then paginates the filtered result.

Unknown scores stay last when sorting by score so incomplete telemetry does not jump ahead of scored listings.

### Missing-item quick filters

The registry also includes a dedicated missing-item quick filter:

- `All listings`
- `Missing cover image`
- `Missing minimum images`
- `Missing description`
- `Missing price`
- `Missing location`

These filters combine with the quality status filter using AND semantics. That means you can narrow to `Needs work` and then further isolate `Missing cover image` without losing score-based triage order.

## How to triage with the registry

Recommended ops pattern:

1. Start with the main search box for title, listing ID, owner, or location.
2. Owner identity now leads the registry owner view:
   - primary: profile full name
   - fallback: email when the admin-safe auth lookup is available
   - fallback: owner UUID
   - listing ID remains secondary copyable metadata in each row
2. Use status, active state, and demo/featured chips to narrow the operational slice further.
3. Change sort order when the workflow is time-based (`Created`, `Updated`, `Expiry`) or quality-based (`Quality`, `Title`, `Live / approved`).
4. Apply a quality status filter if you need broad completeness triage.
5. Apply one missing-item quick filter when the next action is obvious, such as missing price or missing cover image.
6. Open `/admin/listings/[id]` for inspection before deciding whether the listing belongs in review follow-up, host guidance, or no action.

## Listing Inspector
- Route: `/admin/listings/[id]`
- Detail panel for overview, media, location, quality, and guarded lifecycle controls
- No approve/reject actions here (decision mode is still `/admin/review`).

### Lifecycle controls

The inspector now separates two admin-only actions:

- `Deactivate listing`
  - default moderation action
  - sets the listing to `removed`
  - removes it from public browse/search
  - clears active featured visibility
  - revokes property share links
  - keeps listing history for support, payments, bookings, and ops

- `Delete permanently`
  - irreversible hard delete
  - only available after the listing is already `removed`
  - requires a typed confirmation and admin reason
  - blocked when protected history still exists
  - preserves a lightweight admin audit record even after the listing row is gone

Use `Deactivate listing` for almost every operational takedown. Use `Delete permanently` only for spam, duplicate junk, test data, or legal/privacy removal.

### Purge dependency model

Permanent delete is intentionally conservative.

Protected history blocks purge, including:

- shortlet bookings and payments
- message threads
- listing leads
- viewing requests
- commission agreements
- featured/listing payment records
- property request response items

Cleanup-only records may still be deleted by cascade when purge is allowed, including:

- listing media
- share links
- saved/favourite references
- analytics/check-in telemetry
- shortlet settings

This keeps marketplace removal safe by default and avoids silently destroying commercial or support history.
Permanent delete still leaves an admin audit stub with the purge reason, deleted listing id, and dependency counts.

### Quality panel in the inspector

The inspector includes a `Listing quality` section so admins can verify why the registry is flagging a record.

Use it to inspect:

- quality score when available
- quality status label
- missing-item list
- whether the listing currently has:
  - a cover image
  - minimum images
  - description coverage
  - price coverage
  - location coverage

The inspector is the place to confirm whether the listing needs host-side cleanup, admin follow-up, or a formal review action in `/admin/review`.

### Demo listing expectations in the inspector

When a listing is marked demo:

- registry filters and row actions should reflect the demo state
- cards and detail pages can show a `Demo` badge when enabled in admin settings
- images can show a `DEMO` watermark when enabled in admin settings
- visibility still depends on the platform-wide demo visibility policy

## Data source
- Uses `public.admin_review_view` (contract-safe view).
- `ADMIN_REVIEW_QUEUE_SELECT` is used for consistent column selection.
- If the view is missing expected columns, the UI shows a diagnostics banner.
