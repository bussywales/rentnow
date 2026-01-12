-- Saved search push dedupe (idempotent).

CREATE TABLE IF NOT EXISTS public.saved_search_push_dedup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL DEFAULT 'saved_search_match',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_search_push_dedup_unique'
      AND conrelid = 'public.saved_search_push_dedup'::regclass
  ) THEN
    ALTER TABLE public.saved_search_push_dedup
      ADD CONSTRAINT saved_search_push_dedup_unique
      UNIQUE (tenant_id, property_id, reason_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_search_push_dedup_tenant
  ON public.saved_search_push_dedup (tenant_id);

CREATE INDEX IF NOT EXISTS idx_saved_search_push_dedup_property
  ON public.saved_search_push_dedup (property_id);

ALTER TABLE public.saved_search_push_dedup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_search_push_dedup FORCE ROW LEVEL SECURITY;
