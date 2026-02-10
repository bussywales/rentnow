-- Add featured fields to admin_review_view for ops visibility.
drop view if exists public.admin_review_view;
create view public.admin_review_view as
with img as (
  select
    pi.property_id,
    count(*)::int as photo_count,
    min(pi.image_url) filter (where pi.image_url is not null) as first_image_url
  from public.property_images pi
  group by pi.property_id
),
vid as (
  select
    pv.property_id,
    count(*)::int as video_count
  from public.property_videos pv
  group by pv.property_id
)
select
  p.id,
  p.owner_id,
  p.status,
  p.submitted_at,
  p.updated_at,
  p.created_at,
  p.is_approved,
  p.approved_at,
  p.rejected_at,
  p.is_active,
  p.rejection_reason,
  p.expires_at,
  p.is_featured,
  p.featured_rank,
  p.featured_until,
  p.featured_at,
  p.is_demo,

  p.title,
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

  -- listing attributes
  p.price,
  p.currency,
  p.rent_period,
  p.rental_type,
  p.listing_type,
  p.bedrooms,
  p.bathrooms,

  -- computed media fields
  coalesce(img.photo_count, 0) as photo_count,
  coalesce(p.cover_image_url, img.first_image_url) as cover_image_url,
  (coalesce(img.photo_count, 0) > 0 or p.cover_image_url is not null) as has_cover,

  coalesce(vid.video_count, 0) as video_count,
  (coalesce(vid.video_count, 0) > 0) as has_video
from public.properties p
left join img on img.property_id = p.id
left join vid on vid.property_id = p.id;

comment on view public.admin_review_view is 'Admin review queue view with stable, contract-approved columns including expiry and featured status.';

grant select on public.admin_review_view to authenticated;
grant select on public.admin_review_view to anon;

alter view public.admin_review_view set (security_invoker = true);
