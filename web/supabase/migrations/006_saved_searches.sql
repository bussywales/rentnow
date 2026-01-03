-- Saved searches table + RLS policies (idempotent).

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON public.saved_searches (user_id);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved searches select self" ON public.saved_searches;
CREATE POLICY "saved searches select self" ON public.saved_searches
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved searches insert self" ON public.saved_searches;
CREATE POLICY "saved searches insert self" ON public.saved_searches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved searches update self" ON public.saved_searches;
CREATE POLICY "saved searches update self" ON public.saved_searches
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved searches delete self" ON public.saved_searches;
CREATE POLICY "saved searches delete self" ON public.saved_searches
  FOR DELETE
  USING (auth.uid() = user_id);
