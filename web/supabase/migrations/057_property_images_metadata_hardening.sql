-- Ensure property_images metadata columns are sane and allow large files
alter table public.property_images
  alter column bytes type bigint using bytes::bigint;

-- Add lightweight constraints (if missing) to prevent invalid metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_images_width_positive'
  ) THEN
    ALTER TABLE public.property_images
      ADD CONSTRAINT property_images_width_positive
      CHECK (width IS NULL OR width > 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_images_height_positive'
  ) THEN
    ALTER TABLE public.property_images
      ADD CONSTRAINT property_images_height_positive
      CHECK (height IS NULL OR height > 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_images_bytes_nonnegative'
  ) THEN
    ALTER TABLE public.property_images
      ADD CONSTRAINT property_images_bytes_nonnegative
      CHECK (bytes IS NULL OR bytes >= 0);
  END IF;
END$$;
