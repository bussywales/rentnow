-- Keep DB event-name constraint aligned with API ingest allowlist.
ALTER TABLE public.explore_events
  DROP CONSTRAINT IF EXISTS explore_events_event_name_check;

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
      'explore_not_interested',
      'explore_v2_save_toggle',
      'explore_v2_share',
      'explore_v2_cta_open',
      'explore_v2_cta_continue',
      'explore_v2_cta_sheet_opened',
      'explore_v2_cta_primary_clicked',
      'explore_v2_cta_view_details_clicked',
      'explore_v2_cta_save_clicked',
      'explore_v2_cta_share_clicked'
    )
  );
