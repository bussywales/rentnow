alter table if exists public.notifications
  alter column body drop not null,
  alter column href drop not null;
