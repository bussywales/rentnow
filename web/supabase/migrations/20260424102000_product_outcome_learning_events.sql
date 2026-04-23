ALTER TABLE public.product_analytics_events
  DROP CONSTRAINT IF EXISTS product_analytics_events_event_name_check;

ALTER TABLE public.product_analytics_events
  ADD CONSTRAINT product_analytics_events_event_name_check
  CHECK (
    event_name IN (
      'search_performed',
      'filter_applied',
      'result_clicked',
      'listing_viewed',
      'listing_detail_section_viewed',
      'listing_save_clicked',
      'listing_unsave_clicked',
      'shortlist_created',
      'shortlist_shared',
      'property_request_started',
      'property_request_published',
      'contact_submitted',
      'viewing_request_submitted',
      'billing_page_viewed',
      'listing_limit_recovery_viewed',
      'listing_limit_recovery_cta_clicked',
      'plan_selected',
      'checkout_started',
      'checkout_succeeded',
      'listing_created',
      'listing_submitted_for_review',
      'listing_published_live',
      'qr_generated',
      'sign_kit_downloaded',
      'qr_redirect_succeeded',
      'qr_redirect_inactive_listing',
      'service_entrypoint_viewed',
      'service_request_started',
      'service_request_submitted',
      'service_request_matched',
      'service_request_unmatched',
      'provider_lead_sent',
      'provider_lead_accepted',
      'provider_lead_declined',
      'provider_response_submitted'
    )
  );
