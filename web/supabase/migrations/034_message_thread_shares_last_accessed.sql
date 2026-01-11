-- Message thread shares access tracking (idempotent).

ALTER TABLE public.message_thread_shares
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.get_message_thread_share(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
DECLARE
  share_row RECORD;
  is_participant BOOLEAN;
  messages JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO share_row
  FROM public.message_thread_shares
  WHERE token = p_token
  LIMIT 1;

  IF share_row IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT (
    auth.uid() = share_row.created_by
    OR auth.uid() = share_row.tenant_id
    OR EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = share_row.property_id AND pr.owner_id = auth.uid()
    )
  )
  INTO is_participant;

  IF NOT is_participant THEN
    RETURN NULL;
  END IF;

  IF share_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'revoked',
      'expires_at', share_row.expires_at,
      'revoked_at', share_row.revoked_at,
      'property_id', share_row.property_id
    );
  END IF;

  IF share_row.expires_at <= NOW() THEN
    RETURN jsonb_build_object(
      'status', 'expired',
      'expires_at', share_row.expires_at,
      'property_id', share_row.property_id
    );
  END IF;

  UPDATE public.message_thread_shares
  SET last_accessed_at = NOW()
  WHERE id = share_row.id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'property_id', m.property_id,
        'sender_id', m.sender_id,
        'recipient_id', m.recipient_id,
        'body', m.body,
        'created_at', m.created_at
      )
      ORDER BY m.created_at
    ),
    '[]'::jsonb
  )
  INTO messages
  FROM public.messages m
  WHERE m.property_id = share_row.property_id
    AND (m.sender_id = share_row.tenant_id OR m.recipient_id = share_row.tenant_id);

  RETURN jsonb_build_object(
    'status', 'active',
    'expires_at', share_row.expires_at,
    'property_id', share_row.property_id,
    'messages', messages
  );
END $$;

REVOKE ALL ON FUNCTION public.get_message_thread_share(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_message_thread_share(TEXT) TO authenticated;
