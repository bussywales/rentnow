-- Referral MVP v1: codes, tree edges, rewards stream, and app setting defaults.

CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  depth INT NOT NULL CHECK (depth >= 1 AND depth <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referrals_no_self_referral CHECK (referred_user_id <> referrer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_created
  ON public.referrals (referrer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_depth
  ON public.referrals (depth);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level >= 1 AND level <= 5),
  event_type TEXT NOT NULL,
  event_reference TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_amount DOUBLE PRECISION NOT NULL CHECK (reward_amount >= 0),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referrer_user_id, referred_user_id, level, event_type, event_reference)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer_issued
  ON public.referral_rewards (referrer_user_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred_issued
  ON public.referral_rewards (referred_user_id, issued_at DESC);

CREATE OR REPLACE FUNCTION public.is_referral_ancestor(target_ancestor UUID, target_user UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security TO off
AS $$
DECLARE
  cursor_user UUID;
  parent_user UUID;
  step_count INT := 0;
BEGIN
  IF target_ancestor IS NULL OR target_user IS NULL THEN
    RETURN FALSE;
  END IF;

  cursor_user := target_user;

  LOOP
    EXIT WHEN step_count >= 5;

    SELECT r.referrer_user_id
      INTO parent_user
    FROM public.referrals r
    WHERE r.referred_user_id = cursor_user
    LIMIT 1;

    IF parent_user IS NULL THEN
      RETURN FALSE;
    END IF;

    IF parent_user = target_ancestor THEN
      RETURN TRUE;
    END IF;

    cursor_user := parent_user;
    step_count := step_count + 1;
  END LOOP;

  RETURN FALSE;
END;
$$;

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals FORCE ROW LEVEL SECURITY;

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral codes owner select" ON public.referral_codes;
CREATE POLICY "referral codes owner select"
  ON public.referral_codes
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "referral codes admin select" ON public.referral_codes;
CREATE POLICY "referral codes admin select"
  ON public.referral_codes
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "referral codes service write" ON public.referral_codes;
CREATE POLICY "referral codes service write"
  ON public.referral_codes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "referral codes admin write" ON public.referral_codes;
CREATE POLICY "referral codes admin write"
  ON public.referral_codes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "referrals tree select" ON public.referrals;
CREATE POLICY "referrals tree select"
  ON public.referrals
  FOR SELECT
  USING (
    public.is_admin()
    OR auth.uid() = referred_user_id
    OR auth.uid() = referrer_user_id
    OR public.is_referral_ancestor(auth.uid(), referred_user_id)
  );

DROP POLICY IF EXISTS "referrals service insert" ON public.referrals;
CREATE POLICY "referrals service insert"
  ON public.referrals
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "referrals admin write" ON public.referrals;
CREATE POLICY "referrals admin write"
  ON public.referrals
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "referral rewards owner select" ON public.referral_rewards;
CREATE POLICY "referral rewards owner select"
  ON public.referral_rewards
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

DROP POLICY IF EXISTS "referral rewards admin select" ON public.referral_rewards;
CREATE POLICY "referral rewards admin select"
  ON public.referral_rewards
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "referral rewards service insert" ON public.referral_rewards;
CREATE POLICY "referral rewards service insert"
  ON public.referral_rewards
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.app_settings (key, value)
VALUES
  ('referrals_enabled', '{"enabled": false}'::jsonb),
  ('referral_max_depth', '{"value": 5}'::jsonb),
  ('referral_enabled_levels', '{"value": [1]}'::jsonb),
  (
    'referral_reward_rules',
    '{"value": {"1": {"type": "listing_credit", "amount": 1}}}'::jsonb
  ),
  (
    'referral_tier_thresholds',
    '{"value": {"bronze": 0, "silver": 5, "gold": 15, "platinum": 30}}'::jsonb
  ),
  ('referral_caps', '{"value": {"daily": 50, "monthly": 500}}'::jsonb)
ON CONFLICT (key) DO NOTHING;
