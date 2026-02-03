import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property } from "@/lib/types";
import { orderImagesWithCover } from "@/lib/properties/images";

export type OwnerListingRow = Property & {
  property_images?: Array<{
    id: string;
    image_url: string;
    position?: number | null;
    created_at?: string | null;
    width?: number | null;
    height?: number | null;
    bytes?: number | null;
    format?: string | null;
  }>;
};

export async function fetchOwnerListings({
  supabase,
  ownerId,
  isAdmin,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  isAdmin: boolean;
}) {
  const missingPosition = (message?: string | null) =>
    typeof message === "string" &&
    message.includes("position") &&
    message.includes("property_images");

  const buildQuery = (includePosition: boolean) => {
    const imageFields = includePosition
      ? "image_url,id,position,created_at,width,height,bytes,format"
      : "image_url,id,created_at";
    let query = supabase
      .from("properties")
      .select(`*, property_images(${imageFields})`)
      .order("created_at", { ascending: false });

    if (includePosition) {
      query = query
        .order("position", {
          foreignTable: "property_images",
          ascending: true,
        })
        .order("created_at", {
          foreignTable: "property_images",
          ascending: true,
        });
    } else {
      query = query.order("created_at", {
        foreignTable: "property_images",
        ascending: true,
      });
    }

    if (!isAdmin) {
      query = query.eq("owner_id", ownerId);
    }

    return query;
  };

  let { data, error } = await buildQuery(true);
  if (error && missingPosition(error.message)) {
    const fallback = await buildQuery(false);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return { data: [], error: error.message };
  }

  const typed = (data as OwnerListingRow[]) || [];
  const properties = typed.map((row) => ({
    ...row,
    photo_count: row.property_images?.length ?? 0,
    has_cover: !!row.cover_image_url,
    images: orderImagesWithCover(
      row.cover_image_url,
      row.property_images?.map((img) => ({
        id: img.id || img.image_url,
        image_url: img.image_url,
        position: img.position ?? undefined,
        created_at: img.created_at ?? undefined,
        width: img.width ?? null,
        height: img.height ?? null,
        bytes: img.bytes ?? null,
        format: img.format ?? null,
      }))
    ),
  }));

  return { data: properties, error: null };
}
