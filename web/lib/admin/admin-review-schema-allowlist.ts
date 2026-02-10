import { ADMIN_REVIEW_FORBIDDEN_FIELDS } from "./admin-review-contracts";

export const ADMIN_REVIEW_PROPERTIES_COLUMNS = [
  "id",
  "status",
  "updated_at",
  "submitted_at",
  "is_approved",
  "approved_at",
  "rejected_at",
  "is_active",
  "owner_id",
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
  "expires_at",
  "is_featured",
  "featured_rank",
  "featured_until",
  "featured_at",
  "is_demo",
  "price",
  "currency",
  "rent_period",
  "rental_type",
  "listing_type",
  "bedrooms",
  "bathrooms",
  "rejection_reason",
  "photo_count",
  "has_cover",
  "cover_image_url",
  "video_count",
  "has_video",
];

export const ADMIN_REVIEW_IMAGE_COLUMNS = ["id", "image_url", "property_id", "created_at", "width", "height"];

export const ADMIN_REVIEW_VIDEO_COLUMNS = ["id", "video_url", "property_id", "created_at"];

export function assertNoForbiddenColumns(select: string, context: string) {
  for (const field of ADMIN_REVIEW_FORBIDDEN_FIELDS) {
    if (select.includes(field)) {
      throw new Error(
        `[AdminReviewContractViolation] "${field}" used in ${context}. This column does not exist in Supabase schema.`
      );
    }
  }
}
