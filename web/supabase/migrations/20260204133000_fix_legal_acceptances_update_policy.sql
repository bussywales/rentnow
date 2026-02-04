-- Ensure legal_acceptances upserts are allowed for the owner/admin

DROP POLICY IF EXISTS "legal acceptances insert self" ON public.legal_acceptances;
CREATE POLICY "legal acceptances insert self" ON public.legal_acceptances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "legal acceptances update self" ON public.legal_acceptances;
CREATE POLICY "legal acceptances update self" ON public.legal_acceptances
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
