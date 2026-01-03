-- Allow tenant_pro in profile_plans.plan_tier (idempotent).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profile_plans_tier_check'
      AND conrelid = 'public.profile_plans'::regclass
  ) THEN
    ALTER TABLE public.profile_plans
      DROP CONSTRAINT profile_plans_tier_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profile_plans_tier_check'
      AND conrelid = 'public.profile_plans'::regclass
  ) THEN
    ALTER TABLE public.profile_plans
      ADD CONSTRAINT profile_plans_tier_check
      CHECK (plan_tier IN ('free', 'starter', 'pro', 'tenant_pro'));
  END IF;
END $$;
