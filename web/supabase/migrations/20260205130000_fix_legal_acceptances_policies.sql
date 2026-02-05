-- Restore/ensure legal_acceptances policies after hardening changes.

DROP POLICY IF EXISTS "legal acceptances select self" ON public.legal_acceptances;
CREATE POLICY "legal acceptances select self" ON public.legal_acceptances
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "legal acceptances insert self" ON public.legal_acceptances;
CREATE POLICY "legal acceptances insert self" ON public.legal_acceptances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "legal acceptances update self" ON public.legal_acceptances;
CREATE POLICY "legal acceptances update self" ON public.legal_acceptances
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
