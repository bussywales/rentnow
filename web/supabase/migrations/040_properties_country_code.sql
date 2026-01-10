-- Properties country code (idempotent).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS country_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_country_code_check'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_country_code_check
      CHECK (country_code IS NULL OR length(country_code) = 2);
  END IF;
END $$;
