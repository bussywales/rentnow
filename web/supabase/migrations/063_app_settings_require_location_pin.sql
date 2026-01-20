-- Feature flag: require location pin before publish (default off).

insert into public.app_settings (key, value)
values ('require_location_pin_for_publish', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;
