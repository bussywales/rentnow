-- PAYG listing fees + credit gating primitives.

CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  period TEXT,
  listing_credits INT NOT NULL DEFAULT 0,
  featured_credits INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.listing_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  credits_total INT NOT NULL,
  credits_used INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_credits_user ON public.listing_credits (user_id);
CREATE INDEX IF NOT EXISTS idx_listing_credits_user_expiry ON public.listing_credits (user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.listing_credit_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  credit_id UUID NOT NULL REFERENCES public.listing_credits (id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key),
  UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_credit_consumptions_user ON public.listing_credit_consumptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_credit_consumptions_listing ON public.listing_credit_consumptions (listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.listing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'paystack',
  provider_ref TEXT,
  idempotency_key TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_listing_payments_user ON public.listing_payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_payments_listing ON public.listing_payments (listing_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_payments_provider_ref ON public.listing_payments (provider, provider_ref);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  code TEXT PRIMARY KEY,
  role TEXT,
  credits INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  max_redemptions INT,
  redeemed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans FORCE ROW LEVEL SECURITY;

ALTER TABLE public.listing_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_credits FORCE ROW LEVEL SECURITY;

ALTER TABLE public.listing_credit_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_credit_consumptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.listing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_payments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans public read" ON public.plans;
CREATE POLICY "plans public read"
  ON public.plans
  FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "plans admin write" ON public.plans;
CREATE POLICY "plans admin write"
  ON public.plans
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "listing credits owner select" ON public.listing_credits;
CREATE POLICY "listing credits owner select"
  ON public.listing_credits
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "listing credits admin select" ON public.listing_credits;
CREATE POLICY "listing credits admin select"
  ON public.listing_credits
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "listing credits service write" ON public.listing_credits;
CREATE POLICY "listing credits service write"
  ON public.listing_credits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "listing credits admin write" ON public.listing_credits;
CREATE POLICY "listing credits admin write"
  ON public.listing_credits
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "listing credit consumptions owner select" ON public.listing_credit_consumptions;
CREATE POLICY "listing credit consumptions owner select"
  ON public.listing_credit_consumptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "listing credit consumptions admin select" ON public.listing_credit_consumptions;
CREATE POLICY "listing credit consumptions admin select"
  ON public.listing_credit_consumptions
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "listing credit consumptions service write" ON public.listing_credit_consumptions;
CREATE POLICY "listing credit consumptions service write"
  ON public.listing_credit_consumptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "listing credit consumptions admin write" ON public.listing_credit_consumptions;
CREATE POLICY "listing credit consumptions admin write"
  ON public.listing_credit_consumptions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "listing payments owner select" ON public.listing_payments;
CREATE POLICY "listing payments owner select"
  ON public.listing_payments
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "listing payments admin select" ON public.listing_payments;
CREATE POLICY "listing payments admin select"
  ON public.listing_payments
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "listing payments service write" ON public.listing_payments;
CREATE POLICY "listing payments service write"
  ON public.listing_payments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "listing payments admin write" ON public.listing_payments;
CREATE POLICY "listing payments admin write"
  ON public.listing_payments
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "promo codes admin select" ON public.promo_codes;
CREATE POLICY "promo codes admin select"
  ON public.promo_codes
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "promo codes admin write" ON public.promo_codes;
CREATE POLICY "promo codes admin write"
  ON public.promo_codes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.consume_listing_credit(
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
  FROM public.listing_credit_consumptions
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

  SELECT id, credit_id, source, idempotency_key
  INTO existing_row
  FROM public.listing_credit_consumptions
  WHERE listing_id = in_listing_id
  LIMIT 1;

  IF existing_row.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'consumed', false,
      'credit_id', existing_row.credit_id,
      'source', existing_row.source,
      'idempotency_key', existing_row.idempotency_key,
      'already_consumed', true
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
  FROM public.listing_credits
  WHERE user_id = in_user_id
    AND credits_used < credits_total
    AND (expires_at IS NULL OR expires_at > now_ts)
  ORDER BY expires_at NULLS LAST, created_at
  LIMIT 1
  FOR UPDATE;

  IF picked_credit.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_CREDITS');
  END IF;

  UPDATE public.listing_credits
    SET credits_used = credits_used + 1,
        updated_at = now_ts
    WHERE id = picked_credit.id
      AND credits_used < credits_total;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_CREDITS');
  END IF;

  INSERT INTO public.listing_credit_consumptions (
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

GRANT EXECUTE ON FUNCTION public.consume_listing_credit(UUID, UUID, TEXT) TO service_role;

ALTER TABLE public.property_events DROP CONSTRAINT IF EXISTS property_events_event_type_check;
ALTER TABLE public.property_events
  ADD CONSTRAINT property_events_event_type_check
  CHECK (event_type IN (
    'property_view',
    'save_toggle',
    'lead_created',
    'lead_attributed',
    'lead_status_updated',
    'lead_note_added',
    'client_page_lead_viewed',
    'client_page_lead_status_updated',
    'listing_submit_attempted',
    'listing_submit_blocked_no_credits',
    'listing_payment_started',
    'listing_payment_succeeded',
    'listing_credit_consumed',
    'viewing_requested',
    'share_open',
    'featured_impression'
  ));
