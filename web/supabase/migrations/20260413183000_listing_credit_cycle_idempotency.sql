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
