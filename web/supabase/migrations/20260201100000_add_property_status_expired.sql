-- Add expired status to property_status enum (must be committed before use)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'property_status'
      AND e.enumlabel = 'expired'
  ) THEN
    ALTER TYPE public.property_status ADD VALUE 'expired';
  END IF;
END$$;

-- Ask PostgREST to reload schema immediately.
NOTIFY pgrst, 'reload schema';
