-- Extend property lifecycle with pause reasons and status tracking (idempotent).

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
        AND enumlabel = 'changes_requested'
    ) THEN
      ALTER TYPE public.property_status ADD VALUE 'changes_requested';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'public.property_status'::regtype
        AND enumlabel = 'paused_owner'
    ) THEN
      ALTER TYPE public.property_status ADD VALUE 'paused_owner';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'public.property_status'::regtype
        AND enumlabel = 'paused_occupied'
    ) THEN
      ALTER TYPE public.property_status ADD VALUE 'paused_occupied';
    END IF;
  END IF;
END $$;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.properties
SET paused_at = COALESCE(paused_at, updated_at, now())
WHERE status::text IN ('paused', 'paused_owner', 'paused_occupied')
  AND paused_at IS NULL;

UPDATE public.properties
SET status_updated_at = COALESCE(status_updated_at, updated_at, created_at, now())
WHERE status_updated_at IS NULL;

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
      'changes_requested'
    )
  );

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_paused_at_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_paused_at_check
  CHECK (
    status::text NOT IN ('paused', 'paused_owner', 'paused_occupied')
    OR paused_at IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_owner_status ON public.properties (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_status_updated_at ON public.properties (status, updated_at);
