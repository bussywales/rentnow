-- Add cover_image_url to properties (idempotent).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT NULL;

-- Existing policies already allow owners/agents/admins to update properties.
