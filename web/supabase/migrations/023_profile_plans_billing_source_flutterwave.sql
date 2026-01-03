-- Extend billing_source check for Flutterwave (idempotent).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profile_plans_billing_source_check'
      AND conrelid = 'public.profile_plans'::regclass
  ) THEN
    ALTER TABLE public.profile_plans
      DROP CONSTRAINT profile_plans_billing_source_check;
  END IF;

  ALTER TABLE public.profile_plans
    ADD CONSTRAINT profile_plans_billing_source_check
    CHECK (billing_source IN ('manual', 'stripe', 'paystack', 'flutterwave'));
END $$;
