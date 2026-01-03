-- Add properties workflow columns and constraints (idempotent).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE public.properties
  ALTER COLUMN status SET DEFAULT 'draft';

UPDATE public.properties
SET status = CASE
  WHEN status IS NOT NULL THEN status
  WHEN is_approved = TRUE AND is_active = TRUE THEN 'live'
  ELSE 'draft'
END
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_status_check'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_status_check
      CHECK (status::text IN ('draft', 'pending', 'live', 'rejected', 'paused'));
  END IF;
END $$;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bills_included BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS epc_rating TEXT,
  ADD COLUMN IF NOT EXISTS council_tax_band TEXT,
  ADD COLUMN IF NOT EXISTS features TEXT[] DEFAULT '{}'::text[];

UPDATE public.properties
SET bills_included = FALSE
WHERE bills_included IS NULL;

UPDATE public.properties
SET features = '{}'::text[]
WHERE features IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'bills_included'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.properties
      ALTER COLUMN bills_included SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'features'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.properties
      ALTER COLUMN features SET NOT NULL;
  END IF;
END $$;
