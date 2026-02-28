-- Explore funnel analytics events (tenant-only, non-PII payload)

CREATE TABLE IF NOT EXISTS public.explore_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_name TEXT NOT NULL,
  session_id TEXT,
  market_code TEXT,
  intent_type TEXT,
  listing_id UUID REFERENCES public.properties (id) ON DELETE SET NULL,
  slide_index INT,
  feed_size INT,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_explore_events_created_at
  ON public.explore_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_explore_events_event_name_created_at
  ON public.explore_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_explore_events_user_created_at
  ON public.explore_events (user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'explore_events_event_name_check'
      AND conrelid = 'public.explore_events'::regclass
  ) THEN
    ALTER TABLE public.explore_events
      ADD CONSTRAINT explore_events_event_name_check
      CHECK (
        event_name IN (
          'explore_view',
          'explore_swipe',
          'explore_open_details',
          'explore_tap_cta',
          'explore_open_next_steps',
          'explore_open_request_composer',
          'explore_submit_request_attempt',
          'explore_submit_request_success',
          'explore_submit_request_fail',
          'explore_continue_booking',
          'explore_save_toggle',
          'explore_share',
          'explore_not_interested'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'explore_events_market_code_check'
      AND conrelid = 'public.explore_events'::regclass
  ) THEN
    ALTER TABLE public.explore_events
      ADD CONSTRAINT explore_events_market_code_check
      CHECK (market_code IS NULL OR market_code ~ '^[A-Z]{2}$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'explore_events_intent_type_check'
      AND conrelid = 'public.explore_events'::regclass
  ) THEN
    ALTER TABLE public.explore_events
      ADD CONSTRAINT explore_events_intent_type_check
      CHECK (intent_type IS NULL OR intent_type IN ('shortlet', 'rent', 'buy'));
  END IF;
END $$;

ALTER TABLE public.explore_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explore_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "explore events tenant insert" ON public.explore_events;
CREATE POLICY "explore events tenant insert" ON public.explore_events
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "explore events admin select" ON public.explore_events;
CREATE POLICY "explore events admin select" ON public.explore_events
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

INSERT INTO public.app_settings (key, value)
VALUES
  ('explore_analytics_enabled', '{"enabled": true}'::jsonb),
  ('explore_analytics_consent_required', '{"enabled": false}'::jsonb),
  ('explore_analytics_notice_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
