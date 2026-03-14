ALTER TABLE public.property_events DROP CONSTRAINT IF EXISTS property_events_event_type_check;
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
    'listing_submit_attempted',
    'listing_quality_guidance_viewed',
    'listing_quality_fix_clicked',
    'listing_submit_blocked_no_credits',
    'listing_auto_approved',
    'listing_payment_started',
    'listing_payment_succeeded',
    'listing_credit_consumed',
    'agent_network_shared',
    'viewing_requested',
    'share_open',
    'featured_impression'
  ));
