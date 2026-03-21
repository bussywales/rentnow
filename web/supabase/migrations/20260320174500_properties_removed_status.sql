-- Add explicit admin removal status for listings.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'property_status'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'public.property_status'::regtype
        AND enumlabel = 'removed'
    ) THEN
      ALTER TYPE public.property_status ADD VALUE 'removed';
    END IF;
  END IF;
END $$;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_status_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_status_check
  CHECK (
    status::text IN (
      'draft',
      'pending',
      'live',
      'rejected',
      'paused',
      'paused_owner',
      'paused_occupied',
      'expired',
      'changes_requested',
      'removed'
    )
  );
