-- Trust snapshot RPC for public badges (idempotent).

CREATE OR REPLACE FUNCTION public.get_trust_snapshot(target_profile_id UUID)
RETURNS TABLE (
  profile_id UUID,
  email_verified BOOLEAN,
  phone_verified BOOLEAN,
  bank_verified BOOLEAN,
  reliability_power TEXT,
  reliability_water TEXT,
  reliability_internet TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
  SELECT
    p.id AS profile_id,
    p.email_verified,
    p.phone_verified,
    p.bank_verified,
    p.reliability_power,
    p.reliability_water,
    p.reliability_internet
  FROM public.profiles p
  WHERE p.id = target_profile_id
    AND p.role IN ('landlord', 'agent');
$$;

REVOKE ALL ON FUNCTION public.get_trust_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trust_snapshot(UUID) TO anon, authenticated;
