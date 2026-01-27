export const ADMIN_REVIEW_QUEUE_SELECT = [
  "id",
  "status",
  "updated_at",
  "submitted_at",
  "is_approved",
  "approved_at",
  "rejected_at",
  "is_active",
].join(",");

export const ADMIN_REVIEW_DETAIL_SELECT = [
  "id",
  "title",
  "owner_id",
  "city",
  "state_region",
  "country_code",
  "admin_area_1",
  "admin_area_2",
  "postal_code",
  "latitude",
  "longitude",
  "location_label",
  "location_place_id",
  "created_at",
  "updated_at",
  "rejection_reason",
].join(",");

export const ADMIN_REVIEW_IMAGE_SELECT = ["id", "image_url", "property_id", "created_at", "width", "height"].join(",");

export const ADMIN_REVIEW_VIDEO_SELECT = ["id", "video_url", "property_id", "created_at"].join(",");
