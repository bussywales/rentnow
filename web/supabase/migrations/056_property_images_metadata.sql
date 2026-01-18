-- Add optional metadata columns to property_images for cover quality hints
alter table public.property_images
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists bytes integer,
  add column if not exists format text,
  add column if not exists blurhash text;
