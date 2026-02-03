-- Product updates (What's new) system tables and policies.

CREATE TABLE IF NOT EXISTS public.product_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_updates_audience_check'
      AND conrelid = 'public.product_updates'::regclass
  ) THEN
    ALTER TABLE public.product_updates
      ADD CONSTRAINT product_updates_audience_check
      CHECK (audience IN ('all', 'tenant', 'host', 'admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_update_reads (
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  update_id UUID NOT NULL REFERENCES public.product_updates (id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, update_id)
);

CREATE INDEX IF NOT EXISTS idx_product_updates_published_at
  ON public.product_updates (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_updates_audience_published_at
  ON public.product_updates (audience, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_updates_created_at
  ON public.product_updates (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_update_reads_user_read_at
  ON public.product_update_reads (user_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_update_reads_update_id
  ON public.product_update_reads (update_id);

CREATE OR REPLACE FUNCTION public.touch_product_updates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_updates_set_updated_at ON public.product_updates;
CREATE TRIGGER product_updates_set_updated_at
BEFORE UPDATE ON public.product_updates
FOR EACH ROW
EXECUTE FUNCTION public.touch_product_updates_updated_at();

ALTER TABLE public.product_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_updates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_update_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_update_reads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product updates select" ON public.product_updates;
CREATE POLICY "product updates select" ON public.product_updates
  FOR SELECT
  USING (
    published_at IS NOT NULL
    AND (
      audience = 'all'
      OR (
        audience = 'tenant'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'tenant'
        )
      )
      OR (
        audience = 'host'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('landlord', 'agent')
        )
      )
      OR (
        audience = 'admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
      )
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "product updates insert admin" ON public.product_updates;
CREATE POLICY "product updates insert admin" ON public.product_updates
  FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product updates update admin" ON public.product_updates;
CREATE POLICY "product updates update admin" ON public.product_updates
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product updates delete admin" ON public.product_updates;
CREATE POLICY "product updates delete admin" ON public.product_updates
  FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS "product update reads select self" ON public.product_update_reads;
CREATE POLICY "product update reads select self" ON public.product_update_reads
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "product update reads insert self" ON public.product_update_reads;
CREATE POLICY "product update reads insert self" ON public.product_update_reads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "product update reads delete self" ON public.product_update_reads;
CREATE POLICY "product update reads delete self" ON public.product_update_reads
  FOR DELETE
  USING (auth.uid() = user_id);
