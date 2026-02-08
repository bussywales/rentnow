-- Subscriptions + featured credits + featured purchases.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS tier TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_role_tier ON public.plans (role, tier);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subscription_id TEXT NOT NULL,
  status TEXT,
  plan_tier TEXT,
  role TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_credit_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions (id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, period_start)
);

CREATE TABLE IF NOT EXISTS public.featured_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  credits_total INT NOT NULL,
  credits_used INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_featured_credits_user ON public.featured_credits (user_id);
CREATE INDEX IF NOT EXISTS idx_featured_credits_user_expiry ON public.featured_credits (user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.featured_credit_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  credit_id UUID NOT NULL REFERENCES public.featured_credits (id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_featured_credit_consumptions_user ON public.featured_credit_consumptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_featured_credit_consumptions_listing ON public.featured_credit_consumptions (listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.feature_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'paystack',
  provider_ref TEXT,
  idempotency_key TEXT NOT NULL,
  featured_until TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_feature_purchases_user ON public.feature_purchases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_purchases_listing ON public.feature_purchases (listing_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_purchases_provider_ref ON public.feature_purchases (provider, provider_ref);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.subscription_credit_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_credit_issues FORCE ROW LEVEL SECURITY;

ALTER TABLE public.featured_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_credits FORCE ROW LEVEL SECURITY;

ALTER TABLE public.featured_credit_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_credit_consumptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.feature_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_purchases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions owner select" ON public.subscriptions;
CREATE POLICY "subscriptions owner select"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions admin select" ON public.subscriptions;
CREATE POLICY "subscriptions admin select"
  ON public.subscriptions
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "subscriptions service write" ON public.subscriptions;
CREATE POLICY "subscriptions service write"
  ON public.subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "subscription credit issues admin select" ON public.subscription_credit_issues;
CREATE POLICY "subscription credit issues admin select"
  ON public.subscription_credit_issues
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "subscription credit issues service write" ON public.subscription_credit_issues;
CREATE POLICY "subscription credit issues service write"
  ON public.subscription_credit_issues
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "featured credits owner select" ON public.featured_credits;
CREATE POLICY "featured credits owner select"
  ON public.featured_credits
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "featured credits admin select" ON public.featured_credits;
CREATE POLICY "featured credits admin select"
  ON public.featured_credits
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "featured credits service write" ON public.featured_credits;
CREATE POLICY "featured credits service write"
  ON public.featured_credits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "featured credit consumptions owner select" ON public.featured_credit_consumptions;
CREATE POLICY "featured credit consumptions owner select"
  ON public.featured_credit_consumptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "featured credit consumptions admin select" ON public.featured_credit_consumptions;
CREATE POLICY "featured credit consumptions admin select"
  ON public.featured_credit_consumptions
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "featured credit consumptions service write" ON public.featured_credit_consumptions;
CREATE POLICY "featured credit consumptions service write"
  ON public.featured_credit_consumptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "feature purchases owner select" ON public.feature_purchases;
CREATE POLICY "feature purchases owner select"
  ON public.feature_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "feature purchases admin select" ON public.feature_purchases;
CREATE POLICY "feature purchases admin select"
  ON public.feature_purchases
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "feature purchases service write" ON public.feature_purchases;
CREATE POLICY "feature purchases service write"
  ON public.feature_purchases
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.consume_featured_credit(
  in_user_id UUID,
  in_listing_id UUID,
  in_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security TO off
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  existing_row RECORD;
  picked_credit RECORD;
BEGIN
  IF in_user_id IS NULL OR in_listing_id IS NULL OR in_idempotency_key IS NULL OR btrim(in_idempotency_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  SELECT id, credit_id, source, idempotency_key
  INTO existing_row
  FROM public.featured_credit_consumptions
  WHERE idempotency_key = in_idempotency_key
  LIMIT 1;

  IF existing_row.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'consumed', true,
      'credit_id', existing_row.credit_id,
      'source', existing_row.source,
      'idempotency_key', existing_row.idempotency_key,
      'existing', true
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = in_listing_id AND p.owner_id = in_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_OWNER');
  END IF;

  SELECT id, source
  INTO picked_credit
  FROM public.featured_credits
  WHERE user_id = in_user_id
    AND credits_used < credits_total
    AND (expires_at IS NULL OR expires_at > now_ts)
  ORDER BY expires_at NULLS LAST, created_at
  LIMIT 1
  FOR UPDATE;

  IF picked_credit.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_CREDITS');
  END IF;

  UPDATE public.featured_credits
    SET credits_used = credits_used + 1,
        updated_at = now_ts
    WHERE id = picked_credit.id
      AND credits_used < credits_total;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_CREDITS');
  END IF;

  INSERT INTO public.featured_credit_consumptions (
    user_id,
    listing_id,
    credit_id,
    idempotency_key,
    source,
    created_at
  ) VALUES (
    in_user_id,
    in_listing_id,
    picked_credit.id,
    in_idempotency_key,
    picked_credit.source,
    now_ts
  );

  RETURN jsonb_build_object(
    'ok', true,
    'consumed', true,
    'credit_id', picked_credit.id,
    'source', picked_credit.source,
    'idempotency_key', in_idempotency_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_featured_credit(UUID, UUID, TEXT) TO service_role;

INSERT INTO public.plans (name, role, tier, price, currency, period, listing_credits, featured_credits, is_active)
VALUES
  ('Agent Starter', 'agent', 'starter', 0, 'NGN', 'monthly', 5, 1, TRUE),
  ('Agent Pro', 'agent', 'pro', 0, 'NGN', 'monthly', 15, 3, TRUE),
  ('Landlord Starter', 'landlord', 'starter', 0, 'NGN', 'monthly', 3, 1, TRUE),
  ('Landlord Pro', 'landlord', 'pro', 0, 'NGN', 'monthly', 10, 2, TRUE)
ON CONFLICT (role, tier) DO UPDATE
  SET listing_credits = EXCLUDED.listing_credits,
      featured_credits = EXCLUDED.featured_credits,
      updated_at = NOW();
