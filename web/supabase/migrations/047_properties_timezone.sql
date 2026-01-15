-- Add timezone to properties with default
ALTER TABLE IF EXISTS public.properties
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Lagos';

-- Backfill any existing nulls just in case
UPDATE public.properties
SET timezone = 'Africa/Lagos'
WHERE timezone IS NULL;
