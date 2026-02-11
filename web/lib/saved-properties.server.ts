import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property } from "@/lib/types";
import { orderImagesWithCover } from "@/lib/properties/images";

type PropertyImageRow = {
  id: string;
  image_url: string;
  position?: number | null;
  created_at?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
};

type SavedPropertyRow = {
  property_id: string | null;
  properties?: Property | Property[] | null;
};

type SavedCollectionRow = {
  id: string;
};

type SavedCollectionItemRow = {
  listing_id: string | null;
  properties?: Property | Property[] | null;
};

async function fetchDefaultCollectionId({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("saved_collections")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("is_default", true)
    .maybeSingle<SavedCollectionRow>();
  if (error) return null;
  return data?.id ?? null;
}

export async function fetchSavedPropertyIds({
  supabase,
  userId,
  propertyIds,
}: {
  supabase: SupabaseClient;
  userId: string;
  propertyIds?: string[];
}): Promise<Set<string>> {
  if (!userId) return new Set();
  const defaultCollectionId = await fetchDefaultCollectionId({ supabase, userId });
  if (defaultCollectionId) {
    let query = supabase
      .from("saved_collection_items")
      .select("listing_id")
      .eq("collection_id", defaultCollectionId);
    if (propertyIds && propertyIds.length > 0) {
      query = query.in("listing_id", propertyIds);
    }
    const { data, error } = await query;
    if (!error) {
      const ids = (data || [])
        .map((row: { listing_id?: string | null }) => row.listing_id)
        .filter((value): value is string => !!value);
      return new Set(ids);
    }
  }

  let fallbackQuery = supabase.from("saved_properties").select("property_id").eq("user_id", userId);
  if (propertyIds && propertyIds.length > 0) {
    fallbackQuery = fallbackQuery.in("property_id", propertyIds);
  }
  const { data: fallbackData } = await fallbackQuery;
  const fallbackIds = (fallbackData || [])
    .map((row: { property_id?: string | null }) => row.property_id)
    .filter((value): value is string => !!value);
  return new Set(fallbackIds);
}

export async function fetchSavedProperties({
  supabase,
  userId,
  limit = 12,
}: {
  supabase: SupabaseClient;
  userId: string;
  limit?: number;
}): Promise<Property[]> {
  if (!userId) return [];
  const defaultCollectionId = await fetchDefaultCollectionId({ supabase, userId });
  if (defaultCollectionId) {
    const { data, error } = await supabase
      .from("saved_collection_items")
      .select(
        "listing_id, created_at, properties(id, owner_id, title, description, city, country, state_region, neighbourhood, address, latitude, longitude, listing_type, rental_type, price, currency, rent_period, bedrooms, bathrooms, bathroom_type, furnished, size_value, size_unit, year_built, deposit_amount, deposit_currency, pets_allowed, amenities, available_from, max_guests, is_approved, is_active, status, created_at, updated_at, cover_image_url, is_featured, featured_rank, featured_until, featured_at, featured_by, is_demo, property_images(image_url,id, position, created_at))"
      )
      .eq("collection_id", defaultCollectionId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && data) {
      const mapped = (data as SavedCollectionItemRow[])
        .flatMap((row) => {
          const property = Array.isArray(row.properties)
            ? (row.properties[0] as Property | undefined)
            : (row.properties as Property | null);
          if (!property) return [];
          const images =
            (property as Property & { property_images?: PropertyImageRow[] | null })
              ?.property_images?.map((img) => ({
                id: img.id || img.image_url,
                image_url: img.image_url,
                position: img.position ?? null,
                created_at: img.created_at ?? undefined,
                width: img.width ?? null,
                height: img.height ?? null,
                bytes: img.bytes ?? null,
                format: img.format ?? null,
              })) || [];
          return [{ ...property, images: orderImagesWithCover(property.cover_image_url, images) }];
        })
        .filter((property) => property.id);
      if (mapped.length > 0) {
        return mapped;
      }
    }
  }

  const { data, error } = await supabase
    .from("saved_properties")
    .select(
      "property_id, created_at, properties(id, owner_id, title, description, city, country, state_region, neighbourhood, address, latitude, longitude, listing_type, rental_type, price, currency, rent_period, bedrooms, bathrooms, bathroom_type, furnished, size_value, size_unit, year_built, deposit_amount, deposit_currency, pets_allowed, amenities, available_from, max_guests, is_approved, is_active, status, created_at, updated_at, cover_image_url, is_featured, featured_rank, featured_until, featured_at, featured_by, property_images(image_url,id, position, created_at))"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as SavedPropertyRow[])
    .flatMap((row) => {
      const property = Array.isArray(row.properties)
        ? (row.properties[0] as Property | undefined)
        : (row.properties as Property | null);
      if (!property) return [];
      const images =
        (property as Property & { property_images?: PropertyImageRow[] | null })
          ?.property_images?.map((img) => ({
            id: img.id || img.image_url,
            image_url: img.image_url,
            position: img.position ?? null,
            created_at: img.created_at ?? undefined,
            width: img.width ?? null,
            height: img.height ?? null,
            bytes: img.bytes ?? null,
            format: img.format ?? null,
          })) || [];
      return [{ ...property, images: orderImagesWithCover(property.cover_image_url, images) }];
    })
    .filter((property) => property.id);
}
