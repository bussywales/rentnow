# Admin Listings Registry

- Route: `/admin/listings` (admin-only).
- Purpose: ops-friendly registry of **all** listings (not just reviewable).
- Selection: clicking a row navigates to `/admin/listings/[id]` for read-only inspection.

## Query params (server-side)
The registry is backed by `GET /api/admin/listings` and the server-side page uses the same query parsing.

- `q` — search text
- `qMode` — `id | owner | title`
  - `id`: exact match on listing id
  - `owner`: exact match on owner id
  - `title`: partial match across title, location_label, city/state
- `status` — multi-select status filter (comma-separated or repeated; normalized + deduped)
- `active` — `all | true | false`
- `page` — 1-based page number (default 1)
- `pageSize` — 25/50/100
- `sort` — `updated_desc | updated_asc | created_desc | created_asc`
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
/admin/listings?q=lagos&qMode=title&status=pending&status=live&active=all&page=1&pageSize=50&sort=updated_desc
```

Canonical status param:
```
/admin/listings?status=draft,pending
```

## Saved views
- Saved views are stored per admin user (`admin_saved_views`).
- Use the **Saved views** dropdown on `/admin/listings` to apply or delete.
- Use **Save view** to persist the current search + filter state.

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

Use the quality status control when you want broad triage by listing completeness instead of filtering on one missing field at a time.

### Quality score sorting

The table supports client-side quality sorting:

- `Highest score first`
- `Lowest score first`

Use score sorting after narrowing the registry to surface the weakest or strongest records in the current result set.

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

1. Start with status, active state, and market/location search to narrow the operational slice.
2. Apply a quality status filter if you need broad completeness triage.
3. Apply one missing-item quick filter when the next action is obvious, such as missing price or missing cover image.
4. Sort by lowest quality score first when you want the weakest listings at the top.
5. Open `/admin/listings/[id]` for inspection before deciding whether the listing belongs in review follow-up, host guidance, or no action.

## Listing Inspector
- Route: `/admin/listings/[id]`
- Read-only detail panel (overview, media, location, notes)
- No approve/reject actions (decision mode is only in `/admin/review`).

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

## Data source
- Uses `public.admin_review_view` (contract-safe view).
- `ADMIN_REVIEW_QUEUE_SELECT` is used for consistent column selection.
- If the view is missing expected columns, the UI shows a diagnostics banner.
