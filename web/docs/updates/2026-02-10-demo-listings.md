# Demo Listings

We shipped demo listings as a first-class listing mode so teams can safely test showcase inventory without polluting customer-facing experiences.

## What’s new

- Listings now support a persistent `is_demo` flag.
- Hosts and admins can mark a listing as demo during create/edit.
- Demo listings now show a clear `Demo` badge on cards and listing detail pages.
- Optional `DEMO` image watermark is available through settings.

## Safety defaults

- Demo listings are hidden from public browse/search/detail surfaces in production unless the viewer is an admin.
- Demo listings are excluded from sitemap/indexing surfaces.
- Demo listings are excluded from saved-search alert dispatch.
- Demo listings cannot be featured or purchased for featured placement.

## Admin toggles

In Admin settings:

- `demo_badge_enabled` (default `true`)
- `demo_watermark_enabled` (default `false`)

Use these to control presentation without changing listing data.
