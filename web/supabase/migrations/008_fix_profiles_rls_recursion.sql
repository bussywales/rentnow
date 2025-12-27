-- Remove recursive profiles admin policy (idempotent).

DROP POLICY IF EXISTS "profiles admin read" ON public.profiles;
