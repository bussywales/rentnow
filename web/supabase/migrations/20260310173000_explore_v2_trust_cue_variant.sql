ALTER TABLE public.explore_events
  ADD COLUMN IF NOT EXISTS trust_cue_variant TEXT,
  ADD COLUMN IF NOT EXISTS trust_cue_enabled BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'explore_events_trust_cue_variant_check'
      AND conrelid = 'public.explore_events'::regclass
  ) THEN
    ALTER TABLE public.explore_events
      ADD CONSTRAINT explore_events_trust_cue_variant_check
      CHECK (
        trust_cue_variant IS NULL OR trust_cue_variant IN ('none', 'instant_confirmation')
      );
  END IF;
END $$;
