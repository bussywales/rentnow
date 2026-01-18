-- Add EXIF-safe metadata columns to property_images
alter table public.property_images
  add column if not exists exif_has_gps boolean,
  add column if not exists exif_captured_at timestamptz;

-- Optional sanity: none enforced to keep backwards compatibility; validation handled in app layer.
