-- Viewing requests host workflow (approve/propose/decline)

ALTER TABLE public.viewing_requests
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'requested',
  ADD COLUMN IF NOT EXISTS approved_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposed_times TIMESTAMPTZ[],
  ADD COLUMN IF NOT EXISTS host_message TEXT,
  ADD COLUMN IF NOT EXISTS decline_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.viewing_requests
  DROP CONSTRAINT IF EXISTS viewing_requests_status_check;

ALTER TABLE public.viewing_requests
  ADD CONSTRAINT viewing_requests_status_check
  CHECK (status IN ('requested','approved','proposed','declined','cancelled','completed','no_show','pending','confirmed'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'viewing_requests_approved_time_check'
  ) THEN
    ALTER TABLE public.viewing_requests
      ADD CONSTRAINT viewing_requests_approved_time_check
      CHECK ((status <> 'approved') OR approved_time IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'viewing_requests_proposed_times_check'
  ) THEN
    ALTER TABLE public.viewing_requests
      ADD CONSTRAINT viewing_requests_proposed_times_check
      CHECK (
        (status <> 'proposed') OR
        (proposed_times IS NOT NULL AND array_length(proposed_times, 1) BETWEEN 1 AND 3)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'viewing_requests_decline_reason_check'
  ) THEN
    ALTER TABLE public.viewing_requests
      ADD CONSTRAINT viewing_requests_decline_reason_check
      CHECK ((status <> 'declined') OR decline_reason_code IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_viewing_requests_property_created
  ON public.viewing_requests (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_viewing_requests_tenant_created
  ON public.viewing_requests (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_viewing_requests_status_created
  ON public.viewing_requests (status, created_at DESC);
