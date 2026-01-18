# Listing media and photo ordering

- Each listing stores photos in `public.property_images` with a `position` column for ordering.
- The first image is treated as the primary/featured image across cards and galleries.
- Owners/agents can reorder photos in the Photos step using the up/down controls; changes persist immediately via `/api/properties/[id]/media-order`.
- Ordering rules:
  - Order must include all current images.
  - Only owners/authorized agents can update order (RLS enforced).
  - Reads always sort by `position ASC, created_at ASC` as a fallback.
- Recommended practice: keep the best horizontal image first for the strongest thumbnail.
