-- Add onboarding fields for landlord/agent profiles (idempotent).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role' AND n.nspname = 'public'
  ) THEN
    BEGIN
      ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'agent';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT,
  ADD COLUMN IF NOT EXISTS areas_served TEXT[];
