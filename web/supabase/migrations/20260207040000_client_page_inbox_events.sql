-- Extend property events for client page inbox telemetry.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'property_events_event_type_check'
      AND conrelid = 'public.property_events'::regclass
  ) THEN
    ALTER TABLE public.property_events
      DROP CONSTRAINT property_events_event_type_check;
  END IF;
  ALTER TABLE public.property_events
    ADD CONSTRAINT property_events_event_type_check
    CHECK (event_type IN (
      'property_view',
      'save_toggle',
      'lead_created',
      'lead_attributed',
      'lead_status_updated',
      'lead_note_added',
      'client_page_lead_viewed',
      'client_page_lead_status_updated',
      'viewing_requested',
      'share_open',
      'featured_impression'
    ));
END $$;
