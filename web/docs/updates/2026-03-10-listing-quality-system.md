---
title: "Listing quality system for titles, media defaults, and host completeness guidance"
audiences: [TENANT, HOST, ADMIN]
areas: [listings, quality, media]
published_at: "2026-03-10"
---

## What changed
- Added a shared helper: `web/lib/properties/listing-quality.ts` with:
  - `computeListingCompleteness(listing)` for score, missing items, and field-level quality booleans.
  - `resolveListingHeroMediaPreference(listing)` for stable public hero preference:
    - featured video only when video is valid
    - otherwise cover image
    - otherwise first ordered image
  - `normalizeListingTitleForDisplay(title)` to reuse existing title formatter consistently.
- Wired title normalization into public listing surfaces:
  - `PropertyCard`
  - `ExploreV2Card`
  - property detail display title path (`/properties/[id]`).
- Standardized Explore hero resolution to prefer explicit cover image when available.
- Added a non-blocking Listing quality summary in host `PropertyStepper` review flow:
  - completeness score
  - up to 5 missing quality items
  - optional video state note

## Why this improves trust and consistency
- Listing presentation now follows one deterministic media/title contract across card and detail surfaces.
- Hosts get clear completeness guidance before submit without introducing new publish traps.
- Quality signals are derived from existing real listing fields only; no synthetic trust labels or DB rewrites.

## Verification steps
- Confirm listing cards/detail show normalized titles from existing formatter logic.
- Confirm cover image is preferred as hero when set; fallback remains stable.
- Confirm featured video only becomes hero when valid video exists.
- Confirm review step shows `Listing quality` summary with score and missing items for incomplete drafts.

## Rollback
- Revert commit: `git revert <sha>`.
