ALTER TABLE public.explore_events
  ADD COLUMN IF NOT EXISTS cta_copy_variant TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'explore_events_cta_copy_variant_check'
      AND conrelid = 'public.explore_events'::regclass
  ) THEN
    ALTER TABLE public.explore_events
      ADD CONSTRAINT explore_events_cta_copy_variant_check
      CHECK (
        cta_copy_variant IS NULL OR cta_copy_variant IN ('default', 'clarity', 'action')
      );
  END IF;
END $$;

INSERT INTO public.app_settings (key, value)
VALUES ('explore_v2_cta_copy_variant', '{"value":"default"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
