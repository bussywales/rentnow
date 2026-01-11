-- Trust public snapshot RPC grants (idempotent).

DO $$
BEGIN
  IF to_regprocedure('public.get_profile_trust_public(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_profile_trust_public(UUID) TO anon;
  END IF;

  IF to_regprocedure('public.get_profiles_trust_public(uuid[])') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_profiles_trust_public(UUID[]) TO anon;
  END IF;
END $$;
