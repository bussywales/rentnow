-- Add additive storage-path columns for original and derivative property images.
alter table public.property_images
  add column if not exists storage_path text,
  add column if not exists original_storage_path text,
  add column if not exists thumb_storage_path text,
  add column if not exists card_storage_path text,
  add column if not exists hero_storage_path text;
