-- Add composite index to speed up saved properties ordering per user.
create index if not exists idx_saved_properties_user_created_at
  on public.saved_properties (user_id, created_at desc);
