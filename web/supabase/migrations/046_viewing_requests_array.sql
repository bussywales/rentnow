-- R16.1a — Tenant Viewing Requests (Data + API foundation)

DROP TABLE IF EXISTS public.viewing_requests;

CREATE TABLE public.viewing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  preferred_times TIMESTAMPTZ[] NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_viewing_requests_tenant_id ON public.viewing_requests (tenant_id);
CREATE INDEX idx_viewing_requests_property_id ON public.viewing_requests (property_id);

-- RLS: tenants can insert/select their own rows only
ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "viewings tenant select" ON public.viewing_requests;
CREATE POLICY "viewings tenant select" ON public.viewing_requests
  FOR SELECT
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "viewings tenant insert" ON public.viewing_requests;
CREATE POLICY "viewings tenant insert" ON public.viewing_requests
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);
