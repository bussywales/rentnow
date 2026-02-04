-- Restore legal_acceptances insert policy dropped during hardening

DROP POLICY IF EXISTS "legal acceptances insert self" ON public.legal_acceptances;
CREATE POLICY "legal acceptances insert self" ON public.legal_acceptances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
