alter table public.properties
  add column if not exists commercial_layout_type text,
  add column if not exists enclosed_rooms integer;

alter table public.properties
  drop constraint if exists properties_commercial_layout_type_check;

alter table public.properties
  add constraint properties_commercial_layout_type_check
  check (
    commercial_layout_type is null
    or commercial_layout_type in (
      'open_plan',
      'partitioned',
      'multi_room',
      'suite',
      'shop_floor',
      'warehouse',
      'mixed'
    )
  );

alter table public.properties
  drop constraint if exists properties_enclosed_rooms_nonnegative_check;

alter table public.properties
  add constraint properties_enclosed_rooms_nonnegative_check
  check (enclosed_rooms is null or enclosed_rooms >= 0);
