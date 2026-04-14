alter table public.properties
  add column if not exists backup_power_type text,
  add column if not exists water_supply_type text,
  add column if not exists internet_availability text,
  add column if not exists security_type text,
  add column if not exists road_access_quality text,
  add column if not exists flood_risk_disclosure text;

alter table public.properties
  drop constraint if exists properties_backup_power_type_check,
  add constraint properties_backup_power_type_check
    check (
      backup_power_type is null
      or backup_power_type in ('none', 'inverter', 'generator', 'solar', 'mixed')
    ),
  drop constraint if exists properties_water_supply_type_check,
  add constraint properties_water_supply_type_check
    check (
      water_supply_type is null
      or water_supply_type in ('mains', 'borehole', 'tanker', 'mixed', 'other')
    ),
  drop constraint if exists properties_internet_availability_check,
  add constraint properties_internet_availability_check
    check (
      internet_availability is null
      or internet_availability in ('none', 'mobile_only', 'broadband', 'fibre')
    ),
  drop constraint if exists properties_security_type_check,
  add constraint properties_security_type_check
    check (
      security_type is null
      or security_type in ('none', 'gated_estate', 'building_security', 'guard', 'cctv', 'mixed')
    ),
  drop constraint if exists properties_road_access_quality_check,
  add constraint properties_road_access_quality_check
    check (
      road_access_quality is null
      or road_access_quality in ('paved_easy', 'mixed', 'rough')
    ),
  drop constraint if exists properties_flood_risk_disclosure_check,
  add constraint properties_flood_risk_disclosure_check
    check (
      flood_risk_disclosure is null
      or flood_risk_disclosure in ('low', 'seasonal', 'known_risk', 'unknown')
    );
