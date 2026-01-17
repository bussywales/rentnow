-- Add cover image url for properties
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS cover_image_url text;
