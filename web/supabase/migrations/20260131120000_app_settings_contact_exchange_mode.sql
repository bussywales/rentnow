-- Contact exchange protection mode (off | redact | block)
insert into public.app_settings (key, value)
values ('contact_exchange_mode', '{"mode":"redact"}'::jsonb)
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
