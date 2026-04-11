alter table public.subscription_price_book_audit_log
  drop constraint if exists subscription_price_book_audit_log_event_type_check;

alter table public.subscription_price_book_audit_log
  add constraint subscription_price_book_audit_log_event_type_check
  check (
    event_type in (
      'draft_created',
      'draft_updated',
      'stripe_price_created',
      'stripe_price_invalidated',
      'published'
    )
  );
