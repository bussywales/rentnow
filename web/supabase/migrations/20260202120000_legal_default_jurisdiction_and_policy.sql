-- Seed default jurisdiction for legal documents and ensure effective-only reads for anon.

insert into public.app_settings (key, value)
values ('legal_default_jurisdiction', '"NG"'::jsonb)
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();

drop policy if exists "legal documents published read" on public.legal_documents;
create policy "legal documents published read" on public.legal_documents
  for select
  to authenticated, anon
  using (status = 'published' and (effective_at is null or effective_at <= now()));

notify pgrst, 'reload schema';
