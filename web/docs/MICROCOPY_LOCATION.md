# Location — Search-First Microcopy Pack (R16.7h)

## Section heading
- Title: Location
- Helper: Used for search relevance and map placement.

## Search
- Label: Search for an area
- Placeholder: Start typing a neighbourhood, estate, or city…
- Helper line 1: Start here — choose the general area first. We’ll pin an approximate location and auto-fill the fields below.
- Helper line 2: Tenants see an approximate area until you choose to share the exact location.
- Loading: Searching...
- Empty state: No matches. Try a nearby area or city.
- Not configured (MAPBOX missing): Location search isn’t configured yet. You can still enter the details below or add coordinates manually.

## Results
- Action text: Use
- Subtitle format: neighbourhood/locality • city • region/district • country (when available)

## Pinned card
- Title: Pinned area
- Secondary: Approximate area (from search) (when source=geocode or precision=approx)
- Helper: No coordinates are shown; this is an approximate area.
- Change action: Change
- No pin state: No pin selected yet.
- Map preview missing token: Map preview isn’t configured yet.
- Map preview failure: Map preview unavailable.

## Fields
- Country label: Country
- Country derived hint: Derived from area search (you can edit this)
- State/Region label: State / Region
- City label: City
- Neighbourhood label: Neighbourhood
- Derived helper (state/city/neighbourhood): Derived from search (editable)

## Address
- Label: Address
- Placeholder: Street, building, house number
- Helper: Optional. Not used for map search.

## Location label
- Label: Location label (shown to tenants as area)

## Advanced
- Toggle: Edit coordinates manually
- Helper: Only adjust this if you know the exact latitude and longitude.

## Publish guard copy (when location required to publish)
- Title: Pin your listing location to publish
- Body: Add an approximate area so guests know where your place is located.
- CTA: Go to location

## Rules
- Tone: calm, clear, no “verified” wording.
- Privacy: never display coordinates to tenants; pinned card and tenant surfaces use labels only.
- Feature flag: search/pin UI is gated by `enable_location_picker`.
- If Mapbox tokens are missing, surfaces show the “not configured” message instead of breaking.

## Where this applies
- Listing wizard Location section (`PropertyStepper.tsx`)
- Geocode/search helper components and related tests
