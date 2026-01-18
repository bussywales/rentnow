# Listing media and photo ordering

- Each listing stores photos in `public.property_images` with a `position` column for ordering.
- The first image is treated as the primary/featured image across cards and galleries.
- Owners/agents can reorder photos in the Photos step using the up/down controls; changes persist immediately via `/api/properties/[id]/media-order`.
- Ordering rules:
  - Order must include all current images.
  - Only owners/authorized agents can update order (RLS enforced).
  - Reads always sort by `position ASC, created_at ASC` as a fallback.
- Recommended practice: keep the best horizontal image first for the strongest thumbnail.

## Cover image
- `properties.cover_image_url` stores an optional cover/featured photo URL.
- Set via `PATCH /api/properties/[id]/cover` with `{ coverImageUrl: string | null }`.
- The cover URL must belong to the property’s existing `property_images` rows; otherwise the API returns 400.
- Owner/authorized agent only; reads are unchanged when no cover is set (ordering remains the fallback).
- Cover-first ordering: when present and valid, cover is promoted to the first slot in image arrays; otherwise ordering follows `position ASC, created_at ASC`.
- Recommended cover: best at 1600×900+ landscape; UI shows a hint when the selected cover is portrait or smaller.
