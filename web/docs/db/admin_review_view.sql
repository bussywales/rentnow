-- Admin review queue view (optional rollout)
-- Safe fields only; no phantom columns.
create or replace view public.admin_review_queue_v as
select
  p.id,
  p.status,
  p.updated_at,
  p.submitted_at,
  p.is_approved,
  p.approved_at,
  p.rejected_at,
  p.is_active,
  p.title,
  p.owner_id,
  p.city,
  p.state_region,
  p.country_code,
  p.admin_area_1,
  p.admin_area_2,
  p.postal_code,
  p.latitude,
  p.longitude,
  p.location_label,
  p.location_place_id,
  p.created_at,
  p.rejection_reason,
  coalesce(count(distinct pi.id), 0) as photo_count,
  coalesce(bool_or(pi.image_url = p.cover_image_url), false) as has_cover,
  coalesce(count(distinct pv.id), 0) as video_count
from public.properties p
left join public.property_images pi on pi.property_id = p.id
left join public.property_videos pv on pv.property_id = p.id
group by
  p.id,
  p.status,
  p.updated_at,
  p.submitted_at,
  p.is_approved,
  p.approved_at,
  p.rejected_at,
  p.is_active,
  p.title,
  p.owner_id,
  p.city,
  p.state_region,
  p.country_code,
  p.admin_area_1,
  p.admin_area_2,
  p.postal_code,
  p.latitude,
  p.longitude,
  p.location_label,
  p.location_place_id,
  p.created_at,
  p.rejection_reason,
  p.cover_image_url;

comment on view public.admin_review_queue_v is
  'Stable admin review queue view; consumes only schema-guaranteed columns and computed media counts.';
