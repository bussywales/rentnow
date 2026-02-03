ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS featured_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.properties
  ALTER COLUMN featured_rank DROP NOT NULL,
  ALTER COLUMN featured_rank DROP DEFAULT;

UPDATE public.properties
SET featured_rank = NULL
WHERE is_featured IS DISTINCT FROM true
  AND featured_rank IS NOT NULL;

DROP INDEX IF EXISTS idx_properties_featured_status;
DROP INDEX IF EXISTS idx_properties_featured_live;

CREATE INDEX IF NOT EXISTS idx_properties_featured_control
  ON public.properties (is_featured, featured_rank, featured_until);

CREATE INDEX IF NOT EXISTS idx_properties_featured_live
  ON public.properties (featured_rank ASC, updated_at DESC)
  WHERE is_featured = true AND status = 'live';

CREATE OR REPLACE FUNCTION public.prevent_non_admin_featured_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF current_user = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF (NEW.is_featured IS DISTINCT FROM OLD.is_featured)
    OR (NEW.featured_rank IS DISTINCT FROM OLD.featured_rank)
    OR (NEW.featured_until IS DISTINCT FROM OLD.featured_until)
    OR (NEW.featured_at IS DISTINCT FROM OLD.featured_at)
    OR (NEW.featured_by IS DISTINCT FROM OLD.featured_by)
  THEN
    RAISE EXCEPTION 'featured fields can only be updated by admins';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_featured_guard ON public.properties;
CREATE TRIGGER trg_properties_featured_guard
BEFORE UPDATE OF is_featured, featured_rank, featured_until, featured_at, featured_by
ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_featured_update();
