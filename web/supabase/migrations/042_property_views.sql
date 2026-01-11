-- Property views telemetry (idempotent).

CREATE TABLE IF NOT EXISTS public.property_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  viewer_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_views_property
  ON public.property_views (property_id);

CREATE INDEX IF NOT EXISTS idx_property_views_created
  ON public.property_views (created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'property_views_viewer_role_check'
      AND conrelid = 'public.property_views'::regclass
  ) THEN
    ALTER TABLE public.property_views
      ADD CONSTRAINT property_views_viewer_role_check
      CHECK (viewer_role IN ('anon', 'tenant', 'landlord', 'agent', 'admin'));
  END IF;
END $$;

ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_views FORCE ROW LEVEL SECURITY;
