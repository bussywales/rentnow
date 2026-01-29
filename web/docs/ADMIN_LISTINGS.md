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
- `status` — multi-select status filter (comma-separated or repeated)
- `active` — `all | true | false`
- `page` — 1-based page number (default 1)
- `pageSize` — 25/50/100
- `sort` — `updated_desc | updated_asc | created_desc | created_asc`
- `missingCover` — `true` to show listings without a cover
- `missingPhotos` — `true` to show listings with photo_count=0
- `missingLocation` — `true` to show listings without location label/coords
- `priceMin` / `priceMax` — numeric price bounds (simple outlier filters)

Example:
```
/admin/listings?q=lagos&qMode=title&status=pending&status=live&active=all&page=1&pageSize=50&sort=updated_desc
```

## Saved views
- Saved views are stored per admin user (`admin_saved_views`).
- Use the **Saved views** dropdown on `/admin/listings` to apply or delete.
- Use **Save view** to persist the current search + filter state.

## Listing Inspector
- Route: `/admin/listings/[id]`
- Read-only detail panel (overview, media, location, notes)
- No approve/reject actions (decision mode is only in `/admin/review`).

## Data source
- Uses `public.admin_review_view` (contract-safe view).
- `ADMIN_REVIEW_QUEUE_SELECT` is used for consistent column selection.
- If the view is missing expected columns, the UI shows a diagnostics banner.
