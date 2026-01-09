-- Properties rent period (idempotent).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS rent_period TEXT NOT NULL DEFAULT 'monthly';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_rent_period_check'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_rent_period_check
      CHECK (rent_period IN ('monthly', 'yearly'));
  END IF;
END $$;
