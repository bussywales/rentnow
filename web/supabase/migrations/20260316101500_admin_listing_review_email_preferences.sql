alter table public.profiles
  add column if not exists listing_review_email_enabled boolean not null default false;
