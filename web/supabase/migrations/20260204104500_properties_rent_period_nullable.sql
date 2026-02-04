-- Allow rent_period to be nullable for sale listings.
ALTER TABLE public.properties
  ALTER COLUMN rent_period DROP NOT NULL;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_rent_period_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_rent_period_check
  CHECK (rent_period IN ('monthly', 'yearly') OR rent_period IS NULL);
