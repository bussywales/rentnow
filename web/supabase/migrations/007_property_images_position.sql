-- Ensure property_images.position exists for ordering (idempotent).

ALTER TABLE public.property_images
  ADD COLUMN IF NOT EXISTS position INT;

ALTER TABLE public.property_images
  ALTER COLUMN position SET DEFAULT 0;

UPDATE public.property_images
SET position = 0
WHERE position IS NULL;

ALTER TABLE public.property_images
  ALTER COLUMN position SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_images_position
  ON public.property_images (property_id, position);
