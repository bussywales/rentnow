create or replace function public.get_public_table_columns(target_table_names text[])
returns table (
  table_name text,
  column_name text
)
language sql
security definer
set search_path = public, pg_catalog
set row_security = off
as $$
  select
    cls.relname::text as table_name,
    attr.attname::text as column_name
  from pg_catalog.pg_attribute attr
  join pg_catalog.pg_class cls
    on cls.oid = attr.attrelid
  join pg_catalog.pg_namespace nsp
    on nsp.oid = cls.relnamespace
  where nsp.nspname = 'public'
    and cls.relkind in ('r', 'p', 'v', 'm')
    and attr.attnum > 0
    and not attr.attisdropped
    and (
      target_table_names is null
      or array_length(target_table_names, 1) is null
      or cls.relname = any(target_table_names)
    )
  order by cls.relname, attr.attnum;
$$;

revoke all on function public.get_public_table_columns(text[]) from public;
grant execute on function public.get_public_table_columns(text[]) to anon, authenticated, service_role;
