-- Properties listing detail fields (idempotent).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listing_type TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS state_region TEXT,
  ADD COLUMN IF NOT EXISTS size_value NUMERIC,
  ADD COLUMN IF NOT EXISTS size_unit TEXT,
  ADD COLUMN IF NOT EXISTS year_built INTEGER,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS deposit_currency TEXT,
  ADD COLUMN IF NOT EXISTS bathroom_type TEXT,
  ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_listing_type_check'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_listing_type_check
      CHECK (
        listing_type IS NULL
        OR listing_type IN (
          'apartment',
          'house',
          'duplex',
          'studio',
          'room',
          'shop',
          'office',
          'land'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_size_unit_check'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_size_unit_check
      CHECK (size_unit IS NULL OR size_unit IN ('sqm', 'sqft'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_bathroom_type_check'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_bathroom_type_check
      CHECK (bathroom_type IS NULL OR bathroom_type IN ('private', 'shared'));
  END IF;
END $$;
