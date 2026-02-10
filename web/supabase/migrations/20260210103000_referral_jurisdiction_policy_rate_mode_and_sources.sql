-- Referral jurisdiction policy: rate mode + eligible reward sources.

ALTER TABLE public.referral_jurisdiction_policies
  ADD COLUMN IF NOT EXISTS cashout_rate_mode TEXT NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS cashout_rate_amount_minor BIGINT,
  ADD COLUMN IF NOT EXISTS cashout_rate_percent NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS cashout_eligible_sources JSONB NOT NULL DEFAULT '["payg_listing_fee_paid","featured_purchase_paid"]'::jsonb;

ALTER TABLE public.referral_jurisdiction_policies
  DROP CONSTRAINT IF EXISTS referral_jurisdiction_policies_rate_mode_chk;

ALTER TABLE public.referral_jurisdiction_policies
  ADD CONSTRAINT referral_jurisdiction_policies_rate_mode_chk
  CHECK (cashout_rate_mode IN ('fixed', 'percent_of_payg'));

UPDATE public.referral_jurisdiction_policies
SET
  cashout_rate_mode = COALESCE(NULLIF(btrim(cashout_rate_mode), ''), 'fixed'),
  cashout_eligible_sources = COALESCE(cashout_eligible_sources, '["payg_listing_fee_paid","featured_purchase_paid"]'::jsonb)
WHERE TRUE;

UPDATE public.referral_jurisdiction_policies
SET cashout_rate_amount_minor = ROUND(GREATEST(0, credit_to_cash_rate) * 100)::BIGINT
WHERE cashout_rate_amount_minor IS NULL
  AND COALESCE(credit_to_cash_rate, 0) > 0;

CREATE INDEX IF NOT EXISTS idx_referral_jurisdiction_policies_country_code_raw
  ON public.referral_jurisdiction_policies (country_code);

CREATE INDEX IF NOT EXISTS idx_referral_jurisdiction_policies_payouts_enabled
  ON public.referral_jurisdiction_policies (payouts_enabled);

CREATE INDEX IF NOT EXISTS idx_referral_jurisdiction_policies_eligible_sources_gin
  ON public.referral_jurisdiction_policies
  USING GIN (cashout_eligible_sources);

ALTER TABLE public.referral_credit_ledger
  ADD COLUMN IF NOT EXISTS reward_source TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE public.referral_credit_ledger
  DROP CONSTRAINT IF EXISTS referral_credit_ledger_reward_source_chk;

ALTER TABLE public.referral_credit_ledger
  ADD CONSTRAINT referral_credit_ledger_reward_source_chk
  CHECK (reward_source IN ('unknown', 'payg_listing_fee_paid', 'featured_purchase_paid', 'subscription_paid'));

CREATE INDEX IF NOT EXISTS idx_referral_credit_ledger_reward_source
  ON public.referral_credit_ledger (user_id, reward_source, created_at DESC);

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
  effective_rate_amount_minor BIGINT := 0;
  payg_setting_raw TEXT := '';
  payg_listing_fee_amount NUMERIC := 0;
  eligible_sources TEXT[] := ARRAY[]::TEXT[];
  eligible_earned_credits INT := 0;
  consumed_credits INT := 0;
  eligible_available_credits INT := 0;
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
    requires_manual_approval,
    cashout_rate_mode,
    cashout_rate_amount_minor,
    cashout_rate_percent,
    cashout_eligible_sources
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
    policy_row.cashout_rate_mode := 'fixed';
    policy_row.cashout_rate_amount_minor := 0;
    policy_row.cashout_rate_percent := NULL;
    policy_row.cashout_eligible_sources := '["payg_listing_fee_paid","featured_purchase_paid"]'::jsonb;
  END IF;

  IF NOT COALESCE(policy_row.payouts_enabled, FALSE) OR NOT COALESCE(policy_row.conversion_enabled, FALSE) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'CASHOUT_DISABLED',
      'country_code', policy_row.country_code
    );
  END IF;

  SELECT COALESCE(
    CASE
      WHEN jsonb_typeof(value) = 'object' THEN COALESCE(NULLIF(btrim(value->>'value'), ''), '0')
      WHEN jsonb_typeof(value) = 'number' THEN value::TEXT
      WHEN jsonb_typeof(value) = 'string' THEN COALESCE(NULLIF(btrim(trim(both '"' FROM value::TEXT)), ''), '0')
      ELSE '0'
    END,
    '0'
  )
  INTO payg_setting_raw
  FROM public.app_settings
  WHERE key = 'payg_listing_fee_amount'
  LIMIT 1;

  IF payg_setting_raw ~ '^[0-9]+(\.[0-9]+)?$' THEN
    payg_listing_fee_amount := payg_setting_raw::NUMERIC;
  ELSE
    payg_listing_fee_amount := 0;
  END IF;

  effective_rate_amount_minor := COALESCE(policy_row.cashout_rate_amount_minor, 0);

  IF COALESCE(policy_row.cashout_rate_mode, 'fixed') = 'percent_of_payg' THEN
    IF effective_rate_amount_minor <= 0
      AND payg_listing_fee_amount > 0
      AND COALESCE(policy_row.cashout_rate_percent, 0) > 0 THEN
      effective_rate_amount_minor := ROUND(payg_listing_fee_amount * policy_row.cashout_rate_percent)::BIGINT;
    END IF;
  END IF;

  IF effective_rate_amount_minor <= 0 AND COALESCE(policy_row.credit_to_cash_rate, 0) > 0 THEN
    effective_rate_amount_minor := ROUND(policy_row.credit_to_cash_rate * 100)::BIGINT;
  END IF;

  IF effective_rate_amount_minor <= 0 THEN
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

  SELECT COALESCE(ARRAY_AGG(source_name), ARRAY[]::TEXT[])
  INTO eligible_sources
  FROM (
    SELECT value::TEXT AS source_name
    FROM jsonb_array_elements_text(COALESCE(policy_row.cashout_eligible_sources, '[]'::jsonb))
    WHERE value IN ('payg_listing_fee_paid', 'featured_purchase_paid', 'subscription_paid')
  ) src;

  SELECT COALESCE(SUM(credits), 0)
  INTO eligible_earned_credits
  FROM public.referral_credit_ledger
  WHERE user_id = in_user_id
    AND type = 'earn'
    AND reward_source = ANY(eligible_sources);

  SELECT COALESCE(SUM(credits), 0)
  INTO consumed_credits
  FROM public.referral_credit_ledger
  WHERE user_id = in_user_id
    AND type IN ('spend', 'revoke');

  eligible_available_credits := GREATEST(
    0,
    COALESCE(eligible_earned_credits, 0) - COALESCE(consumed_credits, 0) - COALESCE(held_credits, 0)
  );

  IF in_credits_requested > eligible_available_credits THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'NO_ELIGIBLE_CREDITS',
      'available_eligible_credits', eligible_available_credits,
      'eligible_sources', COALESCE(policy_row.cashout_eligible_sources, '[]'::jsonb)
    );
  END IF;

  cash_amount := ROUND((in_credits_requested::NUMERIC * effective_rate_amount_minor::NUMERIC) / 100, 2);

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
    ROUND((effective_rate_amount_minor::NUMERIC / 100), 4),
    CASE WHEN COALESCE(policy_row.requires_manual_approval, TRUE) THEN 'pending' ELSE 'approved' END,
    now_ts
  ) RETURNING * INTO request_row;

  INSERT INTO public.referral_credit_ledger (
    user_id,
    type,
    credits,
    source_event,
    source_ref,
    reward_source,
    created_at
  ) VALUES (
    in_user_id,
    'convert_hold',
    in_credits_requested,
    'cashout_request',
    request_row.id::TEXT,
    'unknown',
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
    'available_credits', GREATEST(0, total_balance - (held_credits + in_credits_requested)),
    'available_eligible_credits', GREATEST(0, eligible_available_credits - in_credits_requested)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_referral_cashout(UUID, TEXT, INT) TO service_role;
