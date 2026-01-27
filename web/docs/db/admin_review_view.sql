-- Optional: stable admin review view for derived fields
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
  count(pi.id) as photo_count,
  (count(pv.id) > 0) as has_video
from public.properties p
left join public.property_images pi on pi.property_id = p.id
left join public.property_videos pv on pv.property_id = p.id
group by p.id, p.status, p.updated_at, p.submitted_at, p.is_approved, p.approved_at, p.rejected_at, p.is_active;
