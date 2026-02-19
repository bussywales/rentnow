alter table if exists public.shortlet_settings
  add column if not exists cancellation_policy text not null default 'flexible_48h';

update public.shortlet_settings
set cancellation_policy = 'flexible_48h'
where cancellation_policy is null;

alter table if exists public.shortlet_settings
  drop constraint if exists shortlet_settings_cancellation_policy_check;

alter table if exists public.shortlet_settings
  add constraint shortlet_settings_cancellation_policy_check
    check (
      cancellation_policy in ('flexible_24h', 'flexible_48h', 'moderate_5d', 'strict')
    );
