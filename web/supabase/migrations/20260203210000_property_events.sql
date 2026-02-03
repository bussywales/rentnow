-- Property events telemetry for demand/performance analytics.

CREATE TABLE IF NOT EXISTS public.property_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_role TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_key TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'property_events_event_type_check'
      AND conrelid = 'public.property_events'::regclass
  ) THEN
    ALTER TABLE public.property_events
      ADD CONSTRAINT property_events_event_type_check
      CHECK (event_type IN (
        'property_view',
        'save_toggle',
        'lead_created',
        'viewing_requested',
        'share_open',
        'featured_impression'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_property_events_property
  ON public.property_events (property_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_events_event_type
  ON public.property_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_events_property_type
  ON public.property_events (property_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_events_property_view
  ON public.property_events (property_id, occurred_at DESC)
  WHERE event_type = 'property_view';

ALTER TABLE public.property_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property events admin select" ON public.property_events;
CREATE POLICY "property events admin select" ON public.property_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.insert_property_event(
  in_property_id UUID,
  in_event_type TEXT,
  in_actor_user_id UUID DEFAULT NULL,
  in_actor_role TEXT DEFAULT NULL,
  in_session_key TEXT DEFAULT NULL,
  in_meta JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  existing_count INT;
  event_id UUID;
BEGIN
  IF in_event_type = 'property_view' AND in_session_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.property_events
      WHERE property_id = in_property_id
        AND event_type = 'property_view'
        AND session_key = in_session_key
        AND occurred_at::date = now_ts::date
      LIMIT 1
    ) THEN
      RETURN jsonb_build_object('inserted', false, 'reason', 'deduped');
    END IF;
  ELSIF in_event_type = 'featured_impression' AND in_session_key IS NOT NULL THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.property_events
    WHERE property_id = in_property_id
      AND event_type = 'featured_impression'
      AND session_key = in_session_key
      AND occurred_at::date = now_ts::date;
    IF existing_count >= 10 THEN
      RETURN jsonb_build_object('inserted', false, 'reason', 'daily_cap');
    END IF;
  END IF;

  INSERT INTO public.property_events (
    property_id,
    event_type,
    actor_user_id,
    actor_role,
    session_key,
    meta,
    occurred_at
  ) VALUES (
    in_property_id,
    in_event_type,
    in_actor_user_id,
    in_actor_role,
    in_session_key,
    COALESCE(in_meta, '{}'::jsonb),
    now_ts
  )
  RETURNING id INTO event_id;

  RETURN jsonb_build_object('inserted', true, 'id', event_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_property_event(UUID, TEXT, UUID, TEXT, TEXT, JSONB)
  TO anon, authenticated;
