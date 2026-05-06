ALTER TABLE public.listing_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_transfer_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing transfer requests admin select" ON public.listing_transfer_requests;
CREATE POLICY "listing transfer requests admin select"
  ON public.listing_transfer_requests
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "listing transfer requests service write" ON public.listing_transfer_requests;
CREATE POLICY "listing transfer requests service write"
  ON public.listing_transfer_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "listing transfer requests admin write" ON public.listing_transfer_requests;
CREATE POLICY "listing transfer requests admin write"
  ON public.listing_transfer_requests
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
