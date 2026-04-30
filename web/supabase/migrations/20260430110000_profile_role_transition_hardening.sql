-- Prevent unsupported self-service role transitions while preserving first-time role selection.

CREATE OR REPLACE FUNCTION public.prevent_self_service_profile_role_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NULL THEN
      RETURN NEW;
    END IF;

    IF auth.uid() = NEW.id AND NEW.role::TEXT IN ('tenant', 'landlord', 'agent') THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'unsupported profile role assignment';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() = NEW.id
      AND OLD.role IS NULL
      AND NEW.role::TEXT IN ('tenant', 'landlord', 'agent') THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'unsupported profile role transition';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_self_service_role_insert ON public.profiles;
CREATE TRIGGER profiles_prevent_self_service_role_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_service_profile_role_transition();

DROP TRIGGER IF EXISTS profiles_prevent_self_service_role_update ON public.profiles;
CREATE TRIGGER profiles_prevent_self_service_role_update
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_service_profile_role_transition();

COMMENT ON FUNCTION public.prevent_self_service_profile_role_transition()
IS 'Allows first-time user role claim only; later role changes must use audited admin/service-role paths.';
