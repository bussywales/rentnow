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
- Recommended cover: best at 1600×900+ landscape; UI shows a hint when the selected cover is portrait or smaller (and notes that landscape covers look better).
- Recommended cover suggestion:
  - The Photos step suggests a cover but never applies it automatically.
  - Uses stored image metadata (width/height); if missing, falls back to a lightweight probe on the suggested image only.
  - Card copy: “Recommended cover” with buttons “Use recommended cover” (or “Switch to recommended cover” when a cover exists) and “Dismiss”.
  - Quality hint shows “Cover images look best at 1600×900 or larger.” when applicable.

## Image metadata
- `property_images` stores optional `width`, `height`, `bytes`, and `format` for each photo.
- The Photos step captures dimensions client-side during upload and sends `imageMeta` so cover hints can use real data; fallback probes only when metadata is missing.
- Backfill helper: `scripts/list-missing-image-metadata.mjs` (requires service role) lists rows with null width/height for manual updating.
- `bytes` is stored as BIGINT with sanity checks; width/height are checked > 0 when present; blurhash is accepted and persisted when provided.

## EXIF-safe metadata
- Stored per image: `exif_has_gps` and `exif_captured_at` (timestamps).
- EXIF location coordinates are **not** stored; only a boolean “has GPS” flag is accepted.
- `exif_captured_at` is accepted when valid and not in the far future; otherwise cleared.

## Tenant photo trust signals (toggle)
- Controlled via `public.app_settings` key `show_tenant_photo_trust_signals` (default false).
- When enabled, property detail shows:
  - Location metadata present/not present
  - Capture recency (recent/older/unknown)
- No GPS coordinates or “verified” language is shown.
- SQL to toggle:
  - Enable: `update public.app_settings set value='{"enabled":true}'::jsonb, updated_at=now() where key='show_tenant_photo_trust_signals';`
  - Disable: `update public.app_settings set value='{"enabled":false}'::jsonb, updated_at=now() where key='show_tenant_photo_trust_signals';`
- Admin UI: /admin/settings → Feature flags → Tenant photo details (admin-only toggle).
