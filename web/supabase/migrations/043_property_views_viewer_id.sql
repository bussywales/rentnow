-- Property views viewer id + dedupe index (idempotent).

ALTER TABLE public.property_views
  ADD COLUMN IF NOT EXISTS viewer_id UUID;

CREATE INDEX IF NOT EXISTS idx_property_views_property_viewer_created
  ON public.property_views (property_id, viewer_id, created_at DESC);
