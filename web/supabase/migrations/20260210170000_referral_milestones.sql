-- Referral Growth Pack v1: milestones tables, policies, defaults, and wallet sync support.

CREATE TABLE IF NOT EXISTS public.referral_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  name TEXT NOT NULL,
  active_referrals_threshold INT NOT NULL,
  bonus_credits INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_milestones_threshold_chk CHECK (active_referrals_threshold > 0),
  CONSTRAINT referral_milestones_bonus_chk CHECK (bonus_credits > 0)
);

ALTER TABLE public.referral_milestones
  DROP CONSTRAINT IF EXISTS referral_milestones_threshold_key;

ALTER TABLE public.referral_milestones
  ADD CONSTRAINT referral_milestones_threshold_key
  UNIQUE (active_referrals_threshold);

CREATE TABLE IF NOT EXISTS public.referral_milestone_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.referral_milestones (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_milestone_claims_unique UNIQUE (milestone_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_milestones_enabled_threshold
  ON public.referral_milestones (is_enabled, active_referrals_threshold);

CREATE INDEX IF NOT EXISTS idx_referral_milestone_claims_user
  ON public.referral_milestone_claims (user_id, claimed_at DESC);

-- Idempotency guards for bonus issuance side effects.
WITH duplicate_listing_bonus_rows AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, source
      ORDER BY created_at ASC, id ASC
    ) AS row_rank
  FROM public.listing_credits
  WHERE source LIKE 'referral_milestone_bonus:%'
)
DELETE FROM public.listing_credits target
USING duplicate_listing_bonus_rows dup
WHERE target.id = dup.id
  AND dup.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_credits_referral_milestone_source_unique
  ON public.listing_credits (user_id, source)
  WHERE source LIKE 'referral_milestone_bonus:%';

WITH duplicate_milestone_ledger_rows AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, source_event, source_ref
      ORDER BY created_at ASC, id ASC
    ) AS row_rank
  FROM public.referral_credit_ledger
  WHERE source_event = 'referral_milestone_claimed'
)
DELETE FROM public.referral_credit_ledger target
USING duplicate_milestone_ledger_rows dup
WHERE target.id = dup.id
  AND dup.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_credit_ledger_milestone_unique
  ON public.referral_credit_ledger (user_id, source_event, source_ref)
  WHERE source_event = 'referral_milestone_claimed';

ALTER TABLE public.referral_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_milestones FORCE ROW LEVEL SECURITY;

ALTER TABLE public.referral_milestone_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_milestone_claims FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral milestones auth select" ON public.referral_milestones;
CREATE POLICY "referral milestones auth select"
  ON public.referral_milestones
  FOR SELECT
  USING (auth.uid() IS NOT NULL OR public.is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "referral milestones admin write" ON public.referral_milestones;
CREATE POLICY "referral milestones admin write"
  ON public.referral_milestones
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "referral milestones service write" ON public.referral_milestones;
CREATE POLICY "referral milestones service write"
  ON public.referral_milestones
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "referral milestone claims owner select" ON public.referral_milestone_claims;
CREATE POLICY "referral milestone claims owner select"
  ON public.referral_milestone_claims
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "referral milestone claims admin select" ON public.referral_milestone_claims;
CREATE POLICY "referral milestone claims admin select"
  ON public.referral_milestone_claims
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "referral milestone claims service write" ON public.referral_milestone_claims;
CREATE POLICY "referral milestone claims service write"
  ON public.referral_milestone_claims
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.referral_milestones (name, active_referrals_threshold, bonus_credits, is_enabled)
VALUES
  ('Starter Boost', 3, 2, TRUE),
  ('Momentum Boost', 10, 5, TRUE),
  ('Power Referrer', 25, 10, TRUE)
ON CONFLICT (active_referrals_threshold) DO NOTHING;

INSERT INTO public.app_settings (key, value)
SELECT 'referrals_tier_thresholds',
       COALESCE(
         (SELECT value FROM public.app_settings WHERE key = 'referral_tier_thresholds' LIMIT 1),
         '{"value": {"bronze": 0, "silver": 5, "gold": 15, "platinum": 30}}'::jsonb
       )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES ('referrals_milestones_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.referral_sync_wallet_balance(in_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security TO off
AS $$
DECLARE
  listing_available INT := 0;
  featured_available INT := 0;
  total_available INT := 0;
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  IF in_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(GREATEST(0, credits_total - credits_used)), 0)
  INTO listing_available
  FROM public.listing_credits
  WHERE user_id = in_user_id
    AND (
      source = 'referral_listing_credit'
      OR source LIKE 'referral_milestone_bonus:%'
    )
    AND (expires_at IS NULL OR expires_at > now_ts);

  SELECT COALESCE(SUM(GREATEST(0, credits_total - credits_used)), 0)
  INTO featured_available
  FROM public.featured_credits
  WHERE user_id = in_user_id
    AND source = 'referral_featured_credit'
    AND (expires_at IS NULL OR expires_at > now_ts);

  total_available := COALESCE(listing_available, 0) + COALESCE(featured_available, 0);

  INSERT INTO public.referral_credit_wallet (user_id, credits_balance, updated_at)
  VALUES (in_user_id, total_available, now_ts)
  ON CONFLICT (user_id)
  DO UPDATE SET
    credits_balance = EXCLUDED.credits_balance,
    updated_at = EXCLUDED.updated_at;

  RETURN total_available;
END;
$$;
