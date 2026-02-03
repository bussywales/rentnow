ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_properties_featured_status
  ON public.properties (is_featured, featured_until, status);

CREATE INDEX IF NOT EXISTS idx_properties_featured_live
  ON public.properties (featured_rank DESC, updated_at DESC)
  WHERE is_featured = true AND status = 'live';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE is_featured = true) THEN
    WITH candidates AS (
      SELECT id,
             ROW_NUMBER() OVER (ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS rn
      FROM public.properties
      WHERE status = 'live'
        AND is_active = true
        AND is_approved = true
      LIMIT 3
    )
    UPDATE public.properties AS p
    SET is_featured = true,
        featured_rank = (4 - candidates.rn)
    FROM candidates
    WHERE p.id = candidates.id;
  END IF;
END $$;
