import { createServerSupabaseClient } from "@/lib/supabase/server";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";
import type { ParsedSearchFilters, RentalType } from "@/lib/types";
import { mapSearchFilterToListingIntent } from "@/lib/listing-intents";

type SearchOptions = {
  page?: number;
  pageSize?: number;
  approvedBefore?: string | null;
  featuredOnly?: boolean;
  createdAfter?: string | null;
  includeDemo?: boolean;
};

type QueryWithOr<T> = {
  or: (clause: string) => T;
};

export function applyStayFilterToQuery<T extends QueryWithOr<T>>(
  query: T,
  filters: Pick<ParsedSearchFilters, "stay">
): T {
  if (filters.stay !== "shortlet") return query;
  return query.or("listing_intent.eq.shortlet,rental_type.eq.short_let");
}

export async function searchProperties(filters: ParsedSearchFilters, options: SearchOptions = {}) {
  const supabase = await createServerSupabaseClient();
  const includeDemoListings =
    typeof options.includeDemo === "boolean"
      ? options.includeDemo
      : includeDemoListingsForViewer({ viewerRole: null });
  const missingPosition = (message?: string | null) =>
    typeof message === "string" &&
    message.includes("position") &&
    message.includes("property_images");
  const missingApprovedAt = (message?: string | null) =>
    typeof message === "string" &&
    message.includes("approved_at") &&
    message.includes("properties");
  const missingExpiresAt = (message?: string | null) =>
    typeof message === "string" &&
    message.includes("expires_at") &&
    message.includes("properties");

  const runQuery = async (
    includePosition: boolean,
    approvedBefore: string | null,
    includeExpiryFilter: boolean = true
  ) => {
    const imageFields = includePosition
      ? "id,image_url,position,created_at,width,height,bytes,format"
      : "id,image_url,created_at,width,height,bytes,format";

    const nowIso = new Date().toISOString();
    let query = supabase
      .from("properties")
      .select(
        `*, property_images(${imageFields}), shortlet_settings(property_id,booking_mode,nightly_price_minor)`,
        { count: "exact" }
      )
      .eq("is_approved", true)
      .eq("is_active", true)
      .eq("status", "live");
    if (!includeDemoListings) {
      query = query.eq("is_demo", false);
    }
    if (includeExpiryFilter) {
      query = query.or(`expires_at.is.null,expires_at.gte.${nowIso}`);
    }

    if (approvedBefore) {
      query = query.or(`approved_at.is.null,approved_at.lte.${approvedBefore}`);
    }
    if (options.featuredOnly) {
      query = query
        .eq("is_featured", true)
        .or(`featured_until.is.null,featured_until.gt.${nowIso}`);
    }
    if (options.createdAfter) {
      query = query.gte("created_at", options.createdAfter);
    }
    if (filters.city) {
      query = query.ilike("city", `%${filters.city}%`);
    }
    const listingIntent = mapSearchFilterToListingIntent(filters.listingIntent ?? null);
    if (listingIntent) {
      query = query.eq("listing_intent", listingIntent);
    }
    query = applyStayFilterToQuery(query, filters);
    if (filters.bedrooms !== null) {
      const bedroomsMode = filters.bedroomsMode ?? "exact";
      query =
        bedroomsMode === "minimum"
          ? query.gte("bedrooms", filters.bedrooms)
          : query.eq("bedrooms", filters.bedrooms);
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
    if (filters.propertyType) {
      query = query.eq("listing_type", filters.propertyType);
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

    if (options.featuredOnly) {
      ordered = ordered
        .order("featured_rank", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false });
    } else {
      ordered = ordered.order("created_at", { ascending: false });
    }

    const { data, error, count } = await ordered.range(from, to);
    return { data, error, count };
  };

  const attempt = async (includePosition: boolean, approvedBefore: string | null) => {
    let result = await runQuery(includePosition, approvedBefore);
    if (missingApprovedAt(result.error?.message) && approvedBefore) {
      result = await runQuery(includePosition, null);
    }
    if (missingExpiresAt(result.error?.message)) {
      result = await runQuery(includePosition, approvedBefore, false);
      if (missingApprovedAt(result.error?.message) && approvedBefore) {
        result = await runQuery(includePosition, null, false);
      }
    }
    return result;
  };

  const initial = await attempt(true, options.approvedBefore ?? null);
  if (missingPosition(initial.error?.message)) {
    return attempt(false, options.approvedBefore ?? null);
  }

  return initial;
}
