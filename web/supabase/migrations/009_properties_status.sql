-- Ensure properties.status and workflow metadata exist (idempotent).

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
  ADD COLUMN IF NOT EXISTS status public.property_status;

ALTER TABLE public.properties
  ALTER COLUMN status SET DEFAULT 'draft';

UPDATE public.properties
SET status = 'draft'
WHERE status IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'status'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.properties
      ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
