import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ParsedSearchFilters, RentalType } from "@/lib/types";

type SearchOptions = {
  page?: number;
  pageSize?: number;
};

export async function searchProperties(filters: ParsedSearchFilters, options: SearchOptions = {}) {
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("properties")
    .select("*, property_images(image_url)", { count: "exact" })
    .eq("is_approved", true)
    .eq("is_active", true);

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

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  return { data, error, count };
}
