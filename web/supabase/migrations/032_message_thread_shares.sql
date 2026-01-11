-- Message thread share links (idempotent).

CREATE TABLE IF NOT EXISTS public.message_thread_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_message_thread_shares_token
  ON public.message_thread_shares (token);

CREATE INDEX IF NOT EXISTS idx_message_thread_shares_thread
  ON public.message_thread_shares (thread_id);

CREATE INDEX IF NOT EXISTS idx_message_thread_shares_property_tenant
  ON public.message_thread_shares (property_id, tenant_id);

ALTER TABLE public.message_thread_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_thread_shares FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message thread shares select participants" ON public.message_thread_shares;
CREATE POLICY "message thread shares select participants" ON public.message_thread_shares
  FOR SELECT
  USING (
    auth.uid() = created_by
    OR auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id AND pr.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "message thread shares insert participants" ON public.message_thread_shares;
CREATE POLICY "message thread shares insert participants" ON public.message_thread_shares
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      auth.uid() = tenant_id
      OR EXISTS (
        SELECT 1 FROM public.properties pr
        WHERE pr.id = property_id AND pr.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "message thread shares update participants" ON public.message_thread_shares;
CREATE POLICY "message thread shares update participants" ON public.message_thread_shares
  FOR UPDATE
  USING (
    auth.uid() = created_by
    OR auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id AND pr.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    OR auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id AND pr.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.get_message_thread_share(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
DECLARE
  share_row RECORD;
  messages JSONB;
BEGIN
  SELECT *
  INTO share_row
  FROM public.message_thread_shares
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > NOW()
  LIMIT 1;

  IF share_row IS NULL THEN
    RETURN NULL;
  END IF;

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
    'property_id', share_row.property_id,
    'tenant_id', share_row.tenant_id,
    'created_by', share_row.created_by,
    'expires_at', share_row.expires_at,
    'messages', messages
  );
END $$;

REVOKE ALL ON FUNCTION public.get_message_thread_share(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_message_thread_share(TEXT) TO anon, authenticated;
