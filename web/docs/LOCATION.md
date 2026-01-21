# Location Picker & Geocoding

## What we store
- `latitude` / `longitude` (approximate) on `properties`
- `location_label` (non-sensitive area/city text)
- `location_place_id` (provider id)
- `location_source` (manual | geocode | pin)
- `location_precision` (approx/none)
- Normalized fields (additive, all nullable):
  - `country_code`
  - `admin_area_1` (state/region/province)
  - `admin_area_2` (county/district/LGA)
  - `postal_code`
  - `city` (legacy) + `locality` equivalent
  - `neighbourhood` (legacy) + `sublocality` equivalent

## Privacy
- We do **not** show precise coordinates to tenants. Tenant-facing pages only show an approximate area.
- Street-level addresses should not be surfaced in labels; we strip street numbers from geocode results.

## Feature flag
- DB flag: `app_settings.enable_location_picker` (jsonb `{ "enabled": boolean }`).
- Enable via SQL:
```
update public.app_settings
set value='{"enabled":true}'::jsonb, updated_at=now()
where key='enable_location_picker';
```

## Provider
- Mapbox Geocoding API (server-side): requires `MAPBOX_TOKEN` (or `NEXT_PUBLIC_MAPBOX_TOKEN` for now).
- Endpoint: `GET /api/geocode?q=` (auth: admin/agent/landlord). Returns top 5 sanitized results (city/region level).
- Static map preview in the listing wizard uses `NEXT_PUBLIC_MAPBOX_TOKEN`. If missing, the UI shows “Map preview isn’t configured yet.”
- Setup:
  - Get a Mapbox token from your Mapbox account → Tokens.
  - For Vercel: add `MAPBOX_TOKEN` and `NEXT_PUBLIC_MAPBOX_TOKEN` to Production + Preview envs, then redeploy.
  - For local: add both tokens to `.env.local`.
- Feature flags:
  - `enable_location_picker` (UI)
  - `require_location_pin_for_publish` (publish gate, default off)
- Expected errors:
  - `/api/geocode` returns 501 `{ code: "MAPBOX_NOT_CONFIGURED" }` when the server token is missing.
  - Static preview only works when `NEXT_PUBLIC_MAPBOX_TOKEN` is set.
- Testing checklist:
  - Turn on `enable_location_picker`.
  - Confirm geocode results appear; if not configured, UI shows “Location search isn't configured yet.”
  - Confirm static preview works with `NEXT_PUBLIC_MAPBOX_TOKEN`.

## UI
- Listing wizard shows “Search for an area” first (results + pinned card + preview) when the flag is enabled. After pinning, fill Country → State/Region/Province → County/District/LGA (optional) → City/Town → Neighbourhood/Area → Postal code (optional), then Address, then advanced coordinates.
- Manual latitude/longitude inputs remain under "Edit coordinates" for advanced users or when the picker is disabled.
- Auto-fill is best-effort: we populate empty fields only. Derived hints disappear once edited. “Change” clears the pin but keeps your manual edits.

## Governance
- Feature is behind a flag. Default is disabled.
- Do not expose raw coordinates to tenants.
- MAPBOX_TOKEN is required for location search (server-side).
- If MAPBOX_TOKEN is missing, the UI will show 'Location search isn't configured yet'.
- Use 'Search for an area' to set the map pin; the Address field does not drive search.
- Auto-fill: Selecting a search result can prefill City/State/Neighbourhood when those fields are empty (editable).
- 'Change' on the pin clears the pin only; it does not wipe City/State you already set.
- Publish guard flag: `require_location_pin_for_publish` (default off). When enabled, listings need a pinned area (lat/lng or place_id + label) to publish; drafts still save, and admins bypass the guard.
- Pinned definition: true when (latitude AND longitude) OR (location_place_id AND location_label) are present with non-empty values. Empty strings do not count.
- Tenant privacy: tenant-facing pages and search APIs do not show lat/lng; only non-sensitive labels (city/region/neighbourhood) are rendered.

## Search ranking uses normalized fields
- Tenant search scores eligible listings using normalized location fields before the existing created-at ordering.
- Signals (case-insensitive, punctuation-agnostic): postal prefix/outward code (+100), `admin_area_2` token match (+40), `admin_area_1` token match (+25), city token match (+20), `country_code` token match (+10).
- Postal prefixes handled: GB outward codes (e.g., ST6), US ZIP prefixes (e.g., 94105/941), CA FSAs (e.g., M5V).
- Filters remain hard gates; lat/lng never surface in tenant responses or JSON-LD.

## Normalized examples
- UK: country_code=GB, admin_area_1=England, admin_area_2=Staffordshire (district/county), postal_code when selecting a postcode result.
- Nigeria: country_code=NG, admin_area_1=Lagos, locality/ neighbourhood best-effort (e.g., Ikoyi).
- US: country_code=US, admin_area_1=California (state), admin_area_2 can hold a county when provided.
- Canada: country_code=CA, admin_area_1=Ontario (province), admin_area_2 optional when Mapbox returns a district/county.
