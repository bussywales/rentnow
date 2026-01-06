-- Public trust snapshot helper (idempotent).

CREATE OR REPLACE FUNCTION public.get_profile_trust_public(profile_uuid UUID)
RETURNS TABLE (
  profile_id UUID,
  email_verified BOOLEAN,
  phone_verified BOOLEAN,
  bank_verified BOOLEAN,
  host_rating NUMERIC,
  power_reliability TEXT,
  water_reliability TEXT,
  internet_reliability TEXT
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
    NULL::numeric AS host_rating,
    p.reliability_power AS power_reliability,
    p.reliability_water AS water_reliability,
    p.reliability_internet AS internet_reliability
  FROM public.profiles p
  WHERE p.id = profile_uuid
    AND p.role IN ('landlord', 'agent');
$$;

CREATE OR REPLACE FUNCTION public.get_profiles_trust_public(profile_ids UUID[])
RETURNS TABLE (
  profile_id UUID,
  email_verified BOOLEAN,
  phone_verified BOOLEAN,
  bank_verified BOOLEAN,
  host_rating NUMERIC,
  power_reliability TEXT,
  water_reliability TEXT,
  internet_reliability TEXT
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
    NULL::numeric AS host_rating,
    p.reliability_power AS power_reliability,
    p.reliability_water AS water_reliability,
    p.reliability_internet AS internet_reliability
  FROM public.profiles p
  WHERE p.id = ANY(profile_ids)
    AND p.role IN ('landlord', 'agent');
$$;

REVOKE ALL ON FUNCTION public.get_profile_trust_public(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_trust_public(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_profiles_trust_public(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profiles_trust_public(UUID[]) TO authenticated;
