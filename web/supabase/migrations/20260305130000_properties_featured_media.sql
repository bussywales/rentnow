-- Featured media selector for listing presentation
alter table public.properties
  add column if not exists featured_media text not null default 'image';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_featured_media_check'
  ) then
    alter table public.properties
      add constraint properties_featured_media_check
      check (featured_media in ('image', 'video'));
  end if;
end $$;
