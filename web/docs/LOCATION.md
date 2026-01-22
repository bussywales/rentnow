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

## Location quality (host-only)
- Host-only indicator in the listing Location step; never shown to tenants or in JSON-LD.
- Strong: pinned location + country_code + admin_area_1 + (postal_code or admin_area_2).
- Medium: pinned + country_code + (admin_area_1 or city).
- Weak: everything else (including no pin).
- Missing hints guide hosts: pin an area, add state/region, add county/district/LGA (optional), add postal code (optional).
- Pre-publish checklist surfaces a reminder when location quality is Medium/Weak (host-only, dismissible).
- Review & publish card on the Submit step highlights pin blockers (when the publish flag is on) and recommends improving location completeness with one-click fixes to the Location section.

## Search clarity (host-only, picker enabled)
- Banner shows the active bias: “Searching in {country}” or “Searching worldwide (pick a country for better results)” when no country is set.
- “Why these results?” helper explains that we prioritise the selected country and proximity to the pin (if any).
- Postcode CTA appears when the query looks like a postcode and no country is selected (UK/US/CA-specific when detected, generic otherwise) and lets hosts set the country in one click to re-run the search.
- Pin bias tip appears when proximity is applied: “Tip: Your pinned area is influencing results. Clear the pin to search elsewhere.”
- Empty results show a guided state with actions: Switch country, Clear pinned area (if set), and Try a broader search.
- If Mapbox isn’t configured, the picker explains it and reminds hosts they can still enter fields manually.

## Normalization rules (R16.7k.1)
- Neighbourhood/Area priority: neighborhood > locality > place (only if smaller than city) > district; never duplicates city/admin areas or postcode text.
- County/District/LGA priority: district > region (when unused by admin_area_1) > place if distinct from city; avoid UK-level labels like “United Kingdom”.
- City/Town priority: place > locality > district.
- Postal codes are sanitized per country (single token, trimmed; GB/CA uppercased with spacing, US keeps ZIP/ZIP+4).

## Normalized examples
- UK: country_code=GB, admin_area_1=England, admin_area_2=Staffordshire (district/county), postal_code when selecting a postcode result.
- Nigeria: country_code=NG, admin_area_1=Lagos, locality/ neighbourhood best-effort (e.g., Ikoyi).
- US: country_code=US, admin_area_1=California (state), admin_area_2 can hold a county when provided.
- Canada: country_code=CA, admin_area_1=Ontario (province), admin_area_2 optional when Mapbox returns a district/county.
