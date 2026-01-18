import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ParsedSearchFilters, RentalType } from "@/lib/types";

type SearchOptions = {
  page?: number;
  pageSize?: number;
  approvedBefore?: string | null;
};

export async function searchProperties(filters: ParsedSearchFilters, options: SearchOptions = {}) {
  const supabase = await createServerSupabaseClient();
  const missingPosition = (message?: string | null) =>
    typeof message === "string" &&
    message.includes("position") &&
    message.includes("property_images");
  const missingApprovedAt = (message?: string | null) =>
    typeof message === "string" &&
    message.includes("approved_at") &&
    message.includes("properties");

  const runQuery = async (includePosition: boolean, approvedBefore: string | null) => {
  const imageFields = includePosition
    ? "id,image_url,position,created_at,width,height,bytes,format"
    : "id,image_url,created_at,width,height,bytes,format";

    let query = supabase
      .from("properties")
      .select(`*, property_images(${imageFields})`, { count: "exact" })
      .eq("is_approved", true)
      .eq("is_active", true);

    if (approvedBefore) {
      query = query.or(`approved_at.is.null,approved_at.lte.${approvedBefore}`);
    }
    if (filters.city) {
      query = query.ilike("city", `%${filters.city}%`);
    }
    if (filters.bedrooms !== null) {
      query = query.gte("bedrooms", filters.bedrooms);
    }
    if (filters.minPrice !== null) {
      query = query.gte("price", filters.minPrice);
    }
    if (filters.maxPrice !== null) {
      query = query.lte("price", filters.maxPrice);
    }
    if (filters.rentalType) {
      query = query.eq("rental_type", filters.rentalType as RentalType);
    }
    if (filters.furnished !== null) {
      query = query.eq("furnished", filters.furnished);
    }
    if (filters.amenities?.length) {
      filters.amenities.forEach((amenity) => {
        query = query.contains("amenities", [amenity]);
      });
    }

    const page = options.page && options.page > 0 ? options.page : 1;
    const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 12;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let ordered = query;
    if (includePosition) {
      ordered = ordered
        .order("position", { foreignTable: "property_images", ascending: true })
        .order("created_at", { foreignTable: "property_images", ascending: true });
    } else {
      ordered = ordered.order("created_at", {
        foreignTable: "property_images",
        ascending: true,
      });
    }

    const { data, error, count } = await ordered
      .order("created_at", { ascending: false })
      .range(from, to);
    return { data, error, count };
  };

  const attempt = async (includePosition: boolean, approvedBefore: string | null) => {
    const result = await runQuery(includePosition, approvedBefore);
    if (missingApprovedAt(result.error?.message) && approvedBefore) {
      return runQuery(includePosition, null);
    }
    return result;
  };

  const initial = await attempt(true, options.approvedBefore ?? null);
  if (missingPosition(initial.error?.message)) {
    return attempt(false, options.approvedBefore ?? null);
  }

  return initial;
}
