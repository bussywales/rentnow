// Admin Review – explicit data contracts
// DO NOT add derived or computed columns here.

export const ADMIN_REVIEW_QUEUE_SELECT = `
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
  photo_count,
  has_cover,
  cover_image_url,
  has_video,
  video_count
`;

export const ADMIN_REVIEW_DETAIL_SELECT = `
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
  photo_count,
  has_cover,
  cover_image_url,
  has_video,
  video_count
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
