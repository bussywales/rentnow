-- Referral jurisdiction policies + cashout workflow (manual payout only).

CREATE TABLE IF NOT EXISTS public.referral_jurisdiction_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  conversion_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  credit_to_cash_rate NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  min_cashout_credits INT NOT NULL DEFAULT 0,
  monthly_cashout_cap_amount NUMERIC NOT NULL DEFAULT 0,
  requires_manual_approval BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_jurisdiction_policies_country_code_chk CHECK (char_length(btrim(country_code)) >= 2),
  CONSTRAINT referral_jurisdiction_policies_rate_chk CHECK (credit_to_cash_rate >= 0),
  CONSTRAINT referral_jurisdiction_policies_min_chk CHECK (min_cashout_credits >= 0),
  CONSTRAINT referral_jurisdiction_policies_cap_chk CHECK (monthly_cashout_cap_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_jurisdiction_policies_country_code
  ON public.referral_jurisdiction_policies ((upper(btrim(country_code))));

CREATE TABLE IF NOT EXISTS public.referral_credit_wallet (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  credits_balance INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_credit_wallet_balance_chk CHECK (credits_balance >= 0)
);

CREATE TABLE IF NOT EXISTS public.referral_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  credits INT NOT NULL,
  source_event TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_credit_ledger_type_chk CHECK (type IN ('earn', 'spend', 'convert_hold', 'convert_release', 'revoke')),
  CONSTRAINT referral_credit_ledger_credits_chk CHECK (credits > 0)
);

CREATE INDEX IF NOT EXISTS idx_referral_credit_ledger_user_created
  ON public.referral_credit_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_credit_ledger_source
  ON public.referral_credit_ledger (source_event, source_ref);

CREATE TABLE IF NOT EXISTS public.referral_cashout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  credits_requested INT NOT NULL,
  cash_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  rate_used NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  payout_reference TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  CONSTRAINT referral_cashout_requests_status_chk CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'void')),
  CONSTRAINT referral_cashout_requests_credits_chk CHECK (credits_requested > 0),
  CONSTRAINT referral_cashout_requests_cash_amount_chk CHECK (cash_amount >= 0),
  CONSTRAINT referral_cashout_requests_rate_used_chk CHECK (rate_used >= 0)
);

CREATE INDEX IF NOT EXISTS idx_referral_cashout_requests_user_requested
  ON public.referral_cashout_requests (user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_cashout_requests_status_requested
  ON public.referral_cashout_requests (status, requested_at DESC);

ALTER TABLE public.referral_jurisdiction_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_jurisdiction_policies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.referral_credit_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credit_wallet FORCE ROW LEVEL SECURITY;

ALTER TABLE public.referral_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credit_ledger FORCE ROW LEVEL SECURITY;

ALTER TABLE public.referral_cashout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_cashout_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral jurisdiction policies admin select" ON public.referral_jurisdiction_policies;
CREATE POLICY "referral jurisdiction policies admin select"
  ON public.referral_jurisdiction_policies
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "referral jurisdiction policies admin write" ON public.referral_jurisdiction_policies;
CREATE POLICY "referral jurisdiction policies admin write"
  ON public.referral_jurisdiction_policies
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "referral jurisdiction policies service select" ON public.referral_jurisdiction_policies;
CREATE POLICY "referral jurisdiction policies service select"
  ON public.referral_jurisdiction_policies
  FOR SELECT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "referral credit wallet owner select" ON public.referral_credit_wallet;
CREATE POLICY "referral credit wallet owner select"
  ON public.referral_credit_wallet
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "referral credit wallet admin select" ON public.referral_credit_wallet;
CREATE POLICY "referral credit wallet admin select"
  ON public.referral_credit_wallet
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "referral credit wallet service write" ON public.referral_credit_wallet;
CREATE POLICY "referral credit wallet service write"
  ON public.referral_credit_wallet
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "referral credit wallet admin write" ON public.referral_credit_wallet;
CREATE POLICY "referral credit wallet admin write"
  ON public.referral_credit_wallet
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "referral credit ledger owner select" ON public.referral_credit_ledger;
CREATE POLICY "referral credit ledger owner select"
  ON public.referral_credit_ledger
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "referral credit ledger admin select" ON public.referral_credit_ledger;
CREATE POLICY "referral credit ledger admin select"
  ON public.referral_credit_ledger
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "referral credit ledger service write" ON public.referral_credit_ledger;
CREATE POLICY "referral credit ledger service write"
  ON public.referral_credit_ledger
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "referral credit ledger admin write" ON public.referral_credit_ledger;
CREATE POLICY "referral credit ledger admin write"
  ON public.referral_credit_ledger
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "referral cashout owner select" ON public.referral_cashout_requests;
CREATE POLICY "referral cashout owner select"
  ON public.referral_cashout_requests
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "referral cashout owner insert" ON public.referral_cashout_requests;
CREATE POLICY "referral cashout owner insert"
  ON public.referral_cashout_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "referral cashout admin select" ON public.referral_cashout_requests;
CREATE POLICY "referral cashout admin select"
  ON public.referral_cashout_requests
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "referral cashout admin update" ON public.referral_cashout_requests;
CREATE POLICY "referral cashout admin update"
  ON public.referral_cashout_requests
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "referral cashout service write" ON public.referral_cashout_requests;
CREATE POLICY "referral cashout service write"
  ON public.referral_cashout_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

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
    AND source = 'referral_listing_credit'
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

CREATE OR REPLACE FUNCTION public.referral_get_held_credits(in_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security TO off
AS $$
DECLARE
  held_credits INT := 0;
BEGIN
  IF in_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(credits_requested), 0)
  INTO held_credits
  FROM public.referral_cashout_requests
  WHERE user_id = in_user_id
    AND status IN ('pending', 'approved');

  RETURN GREATEST(0, COALESCE(held_credits, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.referral_wallet_available_credits(in_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security TO off
AS $$
DECLARE
  total_balance INT := 0;
  held_credits INT := 0;
BEGIN
  total_balance := public.referral_sync_wallet_balance(in_user_id);
  held_credits := public.referral_get_held_credits(in_user_id);
  RETURN GREATEST(0, total_balance - held_credits);
END;
$$;

CREATE OR REPLACE FUNCTION public.referral_wallet_totals(in_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security TO off
AS $$
DECLARE
  total_balance INT := 0;
  held_credits INT := 0;
  available_credits INT := 0;
BEGIN
  total_balance := public.referral_sync_wallet_balance(in_user_id);
  held_credits := public.referral_get_held_credits(in_user_id);
  available_credits := GREATEST(0, total_balance - held_credits);

  RETURN jsonb_build_object(
    'total_balance', total_balance,
    'held_credits', held_credits,
    'available_credits', available_credits
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_referral_cashout(
  in_user_id UUID,
  in_country_code TEXT,
  in_credits_requested INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security TO off
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  normalized_country TEXT := upper(COALESCE(NULLIF(btrim(in_country_code), ''), 'NG'));
  policy_row RECORD;
  request_row RECORD;
  total_balance INT := 0;
  held_credits INT := 0;
  available_credits INT := 0;
  monthly_used NUMERIC := 0;
  cash_amount NUMERIC := 0;
BEGIN
  IF in_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_USER');
  END IF;

  IF in_credits_requested IS NULL OR in_credits_requested <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_CREDITS_REQUESTED');
  END IF;

  SELECT
    upper(btrim(country_code)) AS country_code,
    payouts_enabled,
    conversion_enabled,
    credit_to_cash_rate,
    currency,
    min_cashout_credits,
    monthly_cashout_cap_amount,
    requires_manual_approval
  INTO policy_row
  FROM public.referral_jurisdiction_policies
  WHERE upper(btrim(country_code)) = normalized_country
  LIMIT 1;

  IF policy_row.country_code IS NULL THEN
    policy_row.country_code := normalized_country;
    policy_row.payouts_enabled := FALSE;
    policy_row.conversion_enabled := FALSE;
    policy_row.credit_to_cash_rate := 0;
    policy_row.currency := 'NGN';
    policy_row.min_cashout_credits := 0;
    policy_row.monthly_cashout_cap_amount := 0;
    policy_row.requires_manual_approval := TRUE;
  END IF;

  IF NOT COALESCE(policy_row.payouts_enabled, FALSE) OR NOT COALESCE(policy_row.conversion_enabled, FALSE) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'CASHOUT_DISABLED',
      'country_code', policy_row.country_code
    );
  END IF;

  IF COALESCE(policy_row.credit_to_cash_rate, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_RATE');
  END IF;

  IF in_credits_requested < COALESCE(policy_row.min_cashout_credits, 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'BELOW_MIN_CASHOUT',
      'min_cashout_credits', COALESCE(policy_row.min_cashout_credits, 0)
    );
  END IF;

  total_balance := public.referral_sync_wallet_balance(in_user_id);
  held_credits := public.referral_get_held_credits(in_user_id);
  available_credits := GREATEST(0, total_balance - held_credits);

  IF in_credits_requested > available_credits THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'INSUFFICIENT_CREDITS',
      'total_balance', total_balance,
      'held_credits', held_credits,
      'available_credits', available_credits
    );
  END IF;

  cash_amount := ROUND((in_credits_requested * policy_row.credit_to_cash_rate)::numeric, 2);

  IF COALESCE(policy_row.monthly_cashout_cap_amount, 0) > 0 THEN
    SELECT COALESCE(SUM(cash_amount), 0)
    INTO monthly_used
    FROM public.referral_cashout_requests
    WHERE user_id = in_user_id
      AND requested_at >= date_trunc('month', now_ts)
      AND status IN ('pending', 'approved', 'paid');

    IF monthly_used + cash_amount > policy_row.monthly_cashout_cap_amount THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'MONTHLY_CAP_EXCEEDED',
        'monthly_cap_amount', policy_row.monthly_cashout_cap_amount,
        'monthly_used_amount', monthly_used
      );
    END IF;
  END IF;

  INSERT INTO public.referral_cashout_requests (
    user_id,
    country_code,
    credits_requested,
    cash_amount,
    currency,
    rate_used,
    status,
    requested_at
  ) VALUES (
    in_user_id,
    policy_row.country_code,
    in_credits_requested,
    cash_amount,
    COALESCE(NULLIF(btrim(policy_row.currency), ''), 'NGN'),
    policy_row.credit_to_cash_rate,
    CASE WHEN COALESCE(policy_row.requires_manual_approval, TRUE) THEN 'pending' ELSE 'approved' END,
    now_ts
  ) RETURNING * INTO request_row;

  INSERT INTO public.referral_credit_ledger (
    user_id,
    type,
    credits,
    source_event,
    source_ref,
    created_at
  ) VALUES (
    in_user_id,
    'convert_hold',
    in_credits_requested,
    'cashout_request',
    request_row.id::TEXT,
    now_ts
  );

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', request_row.id,
    'status', request_row.status,
    'country_code', request_row.country_code,
    'credits_requested', request_row.credits_requested,
    'cash_amount', request_row.cash_amount,
    'currency', request_row.currency,
    'rate_used', request_row.rate_used,
    'total_balance', total_balance,
    'held_credits', held_credits + in_credits_requested,
    'available_credits', GREATEST(0, total_balance - (held_credits + in_credits_requested))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_referral_cashout_action(
  in_request_id UUID,
  in_action TEXT,
  in_admin_note TEXT DEFAULT NULL,
  in_payout_reference TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security TO off
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  action_value TEXT := lower(COALESCE(btrim(in_action), ''));
  target_status TEXT := NULL;
  request_row RECORD;
  credit_row RECORD;
  remaining INT := 0;
  consume_now INT := 0;
BEGIN
  IF in_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_REQUEST_ID');
  END IF;

  IF action_value NOT IN ('approve', 'reject', 'paid', 'void') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_ACTION');
  END IF;

  SELECT *
  INTO request_row
  FROM public.referral_cashout_requests
  WHERE id = in_request_id
  FOR UPDATE;

  IF request_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'REQUEST_NOT_FOUND');
  END IF;

  IF action_value = 'approve' THEN
    IF request_row.status = 'approved' THEN
      RETURN jsonb_build_object('ok', true, 'status', request_row.status, 'request_id', request_row.id);
    END IF;
    IF request_row.status <> 'pending' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_TRANSITION', 'status', request_row.status);
    END IF;

    UPDATE public.referral_cashout_requests
      SET status = 'approved',
          admin_note = COALESCE(in_admin_note, admin_note),
          decided_at = now_ts
      WHERE id = in_request_id;

    RETURN jsonb_build_object('ok', true, 'status', 'approved', 'request_id', request_row.id);
  END IF;

  IF action_value IN ('reject', 'void') THEN
    target_status := CASE WHEN action_value = 'reject' THEN 'rejected' ELSE 'void' END;

    IF request_row.status = target_status THEN
      RETURN jsonb_build_object('ok', true, 'status', request_row.status, 'request_id', request_row.id);
    END IF;

    IF request_row.status = 'paid' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_TRANSITION', 'status', request_row.status);
    END IF;

    UPDATE public.referral_cashout_requests
      SET status = target_status,
          admin_note = COALESCE(in_admin_note, admin_note),
          decided_at = now_ts
      WHERE id = in_request_id;

    IF NOT EXISTS (
      SELECT 1
      FROM public.referral_credit_ledger
      WHERE type = 'convert_release'
        AND source_event = 'cashout_request'
        AND source_ref = request_row.id::TEXT
    ) THEN
      INSERT INTO public.referral_credit_ledger (
        user_id,
        type,
        credits,
        source_event,
        source_ref,
        created_at
      ) VALUES (
        request_row.user_id,
        'convert_release',
        request_row.credits_requested,
        'cashout_request',
        request_row.id::TEXT,
        now_ts
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'status', target_status,
      'request_id', request_row.id
    );
  END IF;

  -- action_value = 'paid'
  IF request_row.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'status', request_row.status, 'request_id', request_row.id);
  END IF;

  IF request_row.status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_TRANSITION', 'status', request_row.status);
  END IF;

  remaining := request_row.credits_requested;

  FOR credit_row IN
    SELECT id, credits_total, credits_used
    FROM public.listing_credits
    WHERE user_id = request_row.user_id
      AND source = 'referral_listing_credit'
      AND credits_used < credits_total
      AND (expires_at IS NULL OR expires_at > now_ts)
    ORDER BY expires_at NULLS LAST, created_at
    FOR UPDATE
  LOOP
    EXIT WHEN remaining <= 0;
    consume_now := LEAST(remaining, GREATEST(0, credit_row.credits_total - credit_row.credits_used));
    IF consume_now > 0 THEN
      UPDATE public.listing_credits
      SET credits_used = credits_used + consume_now,
          updated_at = now_ts
      WHERE id = credit_row.id;
      remaining := remaining - consume_now;
    END IF;
  END LOOP;

  IF remaining > 0 THEN
    FOR credit_row IN
      SELECT id, credits_total, credits_used
      FROM public.featured_credits
      WHERE user_id = request_row.user_id
        AND source = 'referral_featured_credit'
        AND credits_used < credits_total
        AND (expires_at IS NULL OR expires_at > now_ts)
      ORDER BY expires_at NULLS LAST, created_at
      FOR UPDATE
    LOOP
      EXIT WHEN remaining <= 0;
      consume_now := LEAST(remaining, GREATEST(0, credit_row.credits_total - credit_row.credits_used));
      IF consume_now > 0 THEN
        UPDATE public.featured_credits
        SET credits_used = credits_used + consume_now,
            updated_at = now_ts
        WHERE id = credit_row.id;
        remaining := remaining - consume_now;
      END IF;
    END LOOP;
  END IF;

  IF remaining > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INSUFFICIENT_CREDITS_DURING_SETTLEMENT');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.referral_credit_ledger
    WHERE type = 'spend'
      AND source_event = 'cashout_paid'
      AND source_ref = request_row.id::TEXT
  ) THEN
    INSERT INTO public.referral_credit_ledger (
      user_id,
      type,
      credits,
      source_event,
      source_ref,
      created_at
    ) VALUES (
      request_row.user_id,
      'spend',
      request_row.credits_requested,
      'cashout_paid',
      request_row.id::TEXT,
      now_ts
    );
  END IF;

  PERFORM public.referral_sync_wallet_balance(request_row.user_id);

  UPDATE public.referral_cashout_requests
    SET status = 'paid',
        admin_note = COALESCE(in_admin_note, admin_note),
        payout_reference = COALESCE(NULLIF(btrim(in_payout_reference), ''), payout_reference),
        decided_at = COALESCE(decided_at, now_ts),
        paid_at = now_ts
    WHERE id = in_request_id;

  RETURN jsonb_build_object('ok', true, 'status', 'paid', 'request_id', request_row.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.referral_sync_wallet_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_get_held_credits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_wallet_available_credits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_wallet_totals(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_referral_cashout(UUID, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_referral_cashout_action(UUID, TEXT, TEXT, TEXT) TO service_role;

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
  referral_available INT := 0;
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

  referral_available := public.referral_wallet_available_credits(in_user_id);

  SELECT id, source
  INTO picked_credit
  FROM public.listing_credits
  WHERE user_id = in_user_id
    AND credits_used < credits_total
    AND (expires_at IS NULL OR expires_at > now_ts)
    AND (
      source <> 'referral_listing_credit'
      OR referral_available > 0
    )
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

  IF picked_credit.source = 'referral_listing_credit' THEN
    INSERT INTO public.referral_credit_ledger (
      user_id,
      type,
      credits,
      source_event,
      source_ref,
      created_at
    ) VALUES (
      in_user_id,
      'spend',
      1,
      'listing_credit_consumed',
      in_listing_id::TEXT,
      now_ts
    );

    PERFORM public.referral_sync_wallet_balance(in_user_id);
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
  referral_available INT := 0;
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

  referral_available := public.referral_wallet_available_credits(in_user_id);

  SELECT id, source
  INTO picked_credit
  FROM public.featured_credits
  WHERE user_id = in_user_id
    AND credits_used < credits_total
    AND (expires_at IS NULL OR expires_at > now_ts)
    AND (
      source <> 'referral_featured_credit'
      OR referral_available > 0
    )
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

  IF picked_credit.source = 'referral_featured_credit' THEN
    INSERT INTO public.referral_credit_ledger (
      user_id,
      type,
      credits,
      source_event,
      source_ref,
      created_at
    ) VALUES (
      in_user_id,
      'spend',
      1,
      'featured_credit_consumed',
      in_listing_id::TEXT,
      now_ts
    );

    PERFORM public.referral_sync_wallet_balance(in_user_id);
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

GRANT EXECUTE ON FUNCTION public.consume_listing_credit(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_featured_credit(UUID, UUID, TEXT) TO service_role;
