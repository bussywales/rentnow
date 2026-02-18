# Shortlet Search by Dates and Area

## Goal
Build a tenant search flow that can answer: "Show available shortlets in this area for these dates" with fast, trustworthy results.

## Area filtering strategy
- Use a layered area model so search can degrade cleanly: `country -> state -> city -> district -> postcode -> geohash`.
- Store a normalized searchable area token set on each listing.
- Support both typed location filters (city/postcode) and map bounds.

## Availability matching at scale
- Current MVP pattern: range overlap checks against bookings and host blocks.
- Next scale step: precompute nightly availability rows per listing (`listing_id`, `night_date`, `is_available`) with incremental updates from booking/block events.
- Query strategy for date windows:
  - Fast prefilter by area + listing visibility.
  - Filter by availability overlap (no unavailable nights in `[check_in, check_out)`).
  - Rank by price, distance, and quality.

## Nearest shortlets concept
- Rank by weighted score:
  - distance from requested point or area centroid
  - date availability confidence
  - nightly price competitiveness
  - listing quality and response reliability
- Keep cross-country browsing available; location boosts should not hard-block other markets.

## API evolution notes
- Extend the shortlet availability endpoint to support bulk listing ids for result-page hydration.
- Keep range semantics consistent everywhere: nights are half-open `[check_in, check_out)`.
- Maintain cache keys by listing id + month window for predictable client prefetching.

## TODO sequence
1. Add indexed area search helpers (geohash + city/postcode fallbacks).
2. Add a bulk availability endpoint for search results.
3. Add result ranking that includes nearest + available + price-aware weights.
4. Add instrumentation for "availability prevented invalid booking" conversion impact.
