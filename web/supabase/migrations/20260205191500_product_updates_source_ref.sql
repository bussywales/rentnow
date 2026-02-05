-- Add source tracking to product updates for import sync.

alter table public.product_updates
  add column if not exists source_ref text,
  add column if not exists source_hash text;

create unique index if not exists idx_product_updates_source_ref_audience
  on public.product_updates (source_ref, audience)
  where source_ref is not null;
