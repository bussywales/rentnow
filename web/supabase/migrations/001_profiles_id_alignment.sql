-- Align profiles.id with auth.users and user_id (idempotent).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id UUID;

UPDATE public.profiles
SET id = user_id
WHERE id IS NULL;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_unique UNIQUE (id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.sync_profiles_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profiles_id ON public.profiles;
CREATE TRIGGER sync_profiles_id
BEFORE INSERT OR UPDATE OF user_id, id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profiles_id();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id IS NULL) THEN
    RAISE NOTICE 'profiles.id has nulls; skipping NOT NULL enforcement';
  ELSE
    ALTER TABLE public.profiles ALTER COLUMN id SET NOT NULL;
  END IF;
END $$;
