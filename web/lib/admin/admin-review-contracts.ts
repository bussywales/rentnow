// Admin Review – explicit data contracts
// DO NOT add derived or computed columns here.

export const ADMIN_REVIEW_VIEW_SELECT_MIN = `
  id,
  status,
  updated_at,
  submitted_at,
  is_approved,
  approved_at,
  rejected_at,
  is_active,
  owner_id,
  title,
  city,
  state_region,
  country_code,
  admin_area_1,
  admin_area_2,
  postal_code,
  latitude,
  longitude,
  location_label,
  location_place_id,
  created_at,
  rejection_reason,
  expires_at,
  is_featured,
  featured_rank,
  featured_until,
  featured_at,
  photo_count,
  has_cover,
  cover_image_url,
  has_video,
  video_count
`;

export const ADMIN_REVIEW_VIEW_SELECT_PRICING = `
  price,
  currency,
  rent_period,
  rental_type,
  listing_type,
  bedrooms,
  bathrooms
`;

export const ADMIN_REVIEW_QUEUE_SELECT = `
  ${ADMIN_REVIEW_VIEW_SELECT_MIN},
  ${ADMIN_REVIEW_VIEW_SELECT_PRICING}
`;

export const ADMIN_REVIEW_DETAIL_SELECT = `
  ${ADMIN_REVIEW_VIEW_SELECT_MIN},
  ${ADMIN_REVIEW_VIEW_SELECT_PRICING}
`;

export const ADMIN_REVIEW_IMAGE_SELECT = `
  id,
  image_url,
  property_id,
  created_at,
  width,
  height
`;

export const ADMIN_REVIEW_VIDEO_SELECT = `
  id,
  video_url,
  property_id,
  created_at
`;

// Forbidden fields (documented + enforced) — keep view-only, never raw relations
export const ADMIN_REVIEW_FORBIDDEN_FIELDS = ["property_images", "property_videos"];

export function normalizeSelect(select: string) {
  return select
    .split("\n")
    .map((s) => s.trim().replace(/,+$/, ""))
    .filter(Boolean)
    .join(",");
}

export const ADMIN_REVIEW_VIEW_TABLE = "admin_review_view";

export const ADMIN_REVIEW_VIEW_SELECT_MIN_NORMALIZED = normalizeSelect(ADMIN_REVIEW_VIEW_SELECT_MIN);
export const ADMIN_REVIEW_VIEW_SELECT_PRICING_NORMALIZED = normalizeSelect(ADMIN_REVIEW_VIEW_SELECT_PRICING);
