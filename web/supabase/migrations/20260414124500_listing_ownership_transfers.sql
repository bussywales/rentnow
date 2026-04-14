ALTER TABLE public.listing_credit_consumptions
  DROP CONSTRAINT IF EXISTS listing_credit_consumptions_listing_id_key;

CREATE TABLE IF NOT EXISTS public.listing_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  from_owner_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  to_owner_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  initiator_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_by_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  rejected_by_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  cancelled_by_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  last_failure_code TEXT,
  last_failure_reason TEXT,
  last_failed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT listing_transfer_requests_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  CONSTRAINT listing_transfer_requests_distinct_owners_check CHECK (from_owner_id <> to_owner_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_transfer_requests_property ON public.listing_transfer_requests (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_transfer_requests_from_owner ON public.listing_transfer_requests (from_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_transfer_requests_to_owner ON public.listing_transfer_requests (to_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_transfer_requests_status ON public.listing_transfer_requests (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_transfer_requests_pending_property
  ON public.listing_transfer_requests (property_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listing_transfer_requests_updated_at ON public.listing_transfer_requests;
CREATE TRIGGER trg_listing_transfer_requests_updated_at
BEFORE UPDATE ON public.listing_transfer_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.complete_listing_ownership_transfer(
  in_transfer_id UUID,
  in_accepting_user_id UUID,
  in_requires_entitlement BOOLEAN DEFAULT FALSE,
  in_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security TO off
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  transfer_row RECORD;
  property_row RECORD;
  recipient_profile RECORD;
  active_booking_count INTEGER := 0;
  thread_conflict_count INTEGER := 0;
  picked_credit RECORD;
BEGIN
  IF in_transfer_id IS NULL OR in_accepting_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Transfer input is invalid.');
  END IF;

  SELECT *
  INTO transfer_row
  FROM public.listing_transfer_requests
  WHERE id = in_transfer_id
  FOR UPDATE;

  IF transfer_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND', 'message', 'Transfer request not found.');
  END IF;

  IF transfer_row.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_PENDING', 'message', 'Transfer request is no longer pending.');
  END IF;

  IF transfer_row.to_owner_id <> in_accepting_user_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_RECIPIENT', 'message', 'Only the transfer recipient can accept this request.');
  END IF;

  IF transfer_row.expires_at <= now_ts THEN
    UPDATE public.listing_transfer_requests
      SET status = 'expired',
          responded_at = now_ts,
          updated_at = now_ts,
          last_failure_code = 'REQUEST_EXPIRED',
          last_failure_reason = 'Transfer request expired before acceptance.',
          last_failed_at = now_ts
      WHERE id = transfer_row.id;

    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_EXPIRED', 'message', 'Transfer request expired before acceptance.');
  END IF;

  SELECT p.*
  INTO property_row
  FROM public.properties p
  WHERE p.id = transfer_row.property_id
  FOR UPDATE;

  IF property_row.id IS NULL THEN
    UPDATE public.listing_transfer_requests
      SET last_failure_code = 'LISTING_NOT_FOUND',
          last_failure_reason = 'Listing no longer exists.',
          last_failed_at = now_ts,
          updated_at = now_ts
      WHERE id = transfer_row.id;

    RETURN jsonb_build_object('ok', false, 'code', 'LISTING_NOT_FOUND', 'message', 'Listing no longer exists.');
  END IF;

  IF property_row.owner_id <> transfer_row.from_owner_id THEN
    UPDATE public.listing_transfer_requests
      SET last_failure_code = 'OWNER_CHANGED',
          last_failure_reason = 'Listing owner changed before the transfer was accepted.',
          last_failed_at = now_ts,
          updated_at = now_ts
      WHERE id = transfer_row.id;

    RETURN jsonb_build_object('ok', false, 'code', 'OWNER_CHANGED', 'message', 'Listing owner changed before transfer acceptance.');
  END IF;

  SELECT role
  INTO recipient_profile
  FROM public.profiles
  WHERE id = transfer_row.to_owner_id;

  IF recipient_profile.role IS NULL OR recipient_profile.role NOT IN ('landlord', 'agent') THEN
    UPDATE public.listing_transfer_requests
      SET last_failure_code = 'RECIPIENT_ROLE_INVALID',
          last_failure_reason = 'Recipient must be a landlord or agent account.',
          last_failed_at = now_ts,
          updated_at = now_ts
      WHERE id = transfer_row.id;

    RETURN jsonb_build_object('ok', false, 'code', 'RECIPIENT_ROLE_INVALID', 'message', 'Recipient must be a landlord or agent account.');
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO active_booking_count
  FROM public.shortlet_bookings b
  WHERE b.property_id = property_row.id
    AND b.host_user_id = transfer_row.from_owner_id
    AND b.status IN ('pending_payment', 'pending', 'confirmed');

  IF active_booking_count > 0 THEN
    UPDATE public.listing_transfer_requests
      SET last_failure_code = 'ACTIVE_SHORTLET_BOOKINGS',
          last_failure_reason = 'Complete or clear active shortlet bookings before transferring this listing.',
          last_failed_at = now_ts,
          updated_at = now_ts
      WHERE id = transfer_row.id;

    RETURN jsonb_build_object(
      'ok', false,
      'code', 'ACTIVE_SHORTLET_BOOKINGS',
      'message', 'Complete or clear active shortlet bookings before transferring this listing.'
    );
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO thread_conflict_count
  FROM public.message_threads t
  WHERE t.property_id = property_row.id
    AND t.host_id = transfer_row.to_owner_id;

  IF thread_conflict_count > 0 THEN
    UPDATE public.listing_transfer_requests
      SET last_failure_code = 'MESSAGE_THREAD_CONFLICT',
          last_failure_reason = 'Recipient already has listing message threads. Cancel and resolve message ownership before retrying.',
          last_failed_at = now_ts,
          updated_at = now_ts
      WHERE id = transfer_row.id;

    RETURN jsonb_build_object(
      'ok', false,
      'code', 'MESSAGE_THREAD_CONFLICT',
      'message', 'Recipient already has listing message threads. Resolve the conflict before retrying.'
    );
  END IF;

  IF in_requires_entitlement THEN
    IF in_idempotency_key IS NULL OR btrim(in_idempotency_key) = '' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_IDEMPOTENCY_KEY', 'message', 'Transfer idempotency key is required.');
    END IF;

    SELECT id, source
    INTO picked_credit
    FROM public.listing_credits
    WHERE user_id = transfer_row.to_owner_id
      AND credits_used < credits_total
      AND (expires_at IS NULL OR expires_at > now_ts)
    ORDER BY expires_at NULLS LAST, created_at
    LIMIT 1
    FOR UPDATE;

    IF picked_credit.id IS NULL THEN
      UPDATE public.listing_transfer_requests
        SET last_failure_code = 'NO_CREDITS',
            last_failure_reason = 'Recipient has no listing entitlement available for this transfer.',
            last_failed_at = now_ts,
            updated_at = now_ts
        WHERE id = transfer_row.id;

      RETURN jsonb_build_object('ok', false, 'code', 'NO_CREDITS', 'message', 'Recipient has no listing entitlement available.');
    END IF;

    UPDATE public.listing_credits
      SET credits_used = credits_used + 1,
          updated_at = now_ts
      WHERE id = picked_credit.id
        AND credits_used < credits_total;

    IF NOT FOUND THEN
      UPDATE public.listing_transfer_requests
        SET last_failure_code = 'NO_CREDITS',
            last_failure_reason = 'Recipient listing entitlement was no longer available.',
            last_failed_at = now_ts,
            updated_at = now_ts
        WHERE id = transfer_row.id;

      RETURN jsonb_build_object('ok', false, 'code', 'NO_CREDITS', 'message', 'Recipient has no listing entitlement available.');
    END IF;

    INSERT INTO public.listing_credit_consumptions (
      user_id,
      listing_id,
      credit_id,
      idempotency_key,
      source,
      created_at
    ) VALUES (
      transfer_row.to_owner_id,
      property_row.id,
      picked_credit.id,
      in_idempotency_key,
      picked_credit.source,
      now_ts
    );
  END IF;

  UPDATE public.properties
    SET owner_id = transfer_row.to_owner_id,
        updated_at = now_ts,
        status_updated_at = COALESCE(status_updated_at, now_ts)
    WHERE id = property_row.id;

  UPDATE public.listing_leads
    SET owner_id = transfer_row.to_owner_id,
        updated_at = now_ts
    WHERE property_id = property_row.id
      AND owner_id = transfer_row.from_owner_id;

  UPDATE public.message_threads
    SET host_id = transfer_row.to_owner_id
    WHERE property_id = property_row.id
      AND host_id = transfer_row.from_owner_id;

  UPDATE public.listing_transfer_requests
    SET status = 'accepted',
        responded_at = now_ts,
        accepted_by_user_id = in_accepting_user_id,
        last_failure_code = NULL,
        last_failure_reason = NULL,
        last_failed_at = NULL,
        updated_at = now_ts
    WHERE id = transfer_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'property_id', property_row.id,
    'new_owner_id', transfer_row.to_owner_id,
    'status', 'accepted'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_listing_ownership_transfer(UUID, UUID, BOOLEAN, TEXT) TO service_role;
