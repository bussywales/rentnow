# Location Picker & Geocoding

## What we store
- `latitude` / `longitude` (approximate) on `properties`
- `location_label` (non-sensitive area/city text)
- `location_place_id` (provider id)
- `location_source` (manual | geocode | pin)
- `location_precision` (approx/none)

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

## UI
- Listing wizard shows address search + pin selection when flag enabled.
- Manual latitude/longitude inputs remain under "Edit coordinates" for advanced users.

## Governance
- Feature is behind a flag. Default is disabled.
- Do not expose raw coordinates to tenants.
- MAPBOX_TOKEN is required for location search (server-side).
- If MAPBOX_TOKEN is missing, the UI will show 'Location search isn't configured yet'.
- Use 'Search for an area' to set the map pin; the Address field does not drive search.
- Auto-fill: Selecting a search result can prefill City/State/Neighbourhood when those fields are empty (editable).
- 'Change' on the pin clears the pin only; it does not wipe City/State you already set.
