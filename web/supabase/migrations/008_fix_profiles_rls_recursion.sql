-- Remove recursive profiles admin policy and replace with non-recursive role checks.

DROP POLICY IF EXISTS "profiles admin read" ON public.profiles;
CREATE POLICY "profiles admin read" ON public.profiles
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  );
