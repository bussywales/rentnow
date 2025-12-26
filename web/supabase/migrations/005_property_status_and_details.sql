-- Add property status workflow fields, detail fields, and photo ordering (idempotent).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'property_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.property_status AS ENUM ('draft', 'pending', 'live', 'rejected', 'paused');
  END IF;
END $$;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS status public.property_status,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bills_included BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS epc_rating TEXT,
  ADD COLUMN IF NOT EXISTS council_tax_band TEXT,
  ADD COLUMN IF NOT EXISTS features TEXT[];

ALTER TABLE public.property_images
  ADD COLUMN IF NOT EXISTS position INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_property_images_position ON public.property_images (property_id, position);

UPDATE public.properties
SET status = CASE
  WHEN status IS NOT NULL THEN status
  WHEN is_approved = TRUE AND is_active = TRUE THEN 'live'
  WHEN is_approved = FALSE AND is_active = TRUE THEN 'pending'
  WHEN is_active = FALSE THEN 'draft'
  ELSE 'draft'
END
WHERE status IS NULL;
