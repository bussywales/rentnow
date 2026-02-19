import type { Property } from "@/lib/types";
import { coverBelongsToImages } from "./cover";
import { resolvePropertyImageUrl } from "@/lib/properties/image-url";

type MinimalImage = {
  id: string;
  image_url: string;
  position?: number | null;
  created_at?: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  storage_path?: string | null;
  original_storage_path?: string | null;
  thumb_storage_path?: string | null;
  card_storage_path?: string | null;
  hero_storage_path?: string | null;
};

export function orderImagesWithCover(
  coverImageUrl: string | null | undefined,
  images: MinimalImage[] | null | undefined
): MinimalImage[] {
  if (!images || images.length === 0) return [];
  const sorted = [...images].sort((a, b) => {
    const posA = typeof a.position === "number" ? a.position : Number.POSITIVE_INFINITY;
    const posB = typeof b.position === "number" ? b.position : Number.POSITIVE_INFINITY;
    if (posA !== posB) return posA - posB;
    const dateA = a.created_at ? Date.parse(a.created_at) : Number.POSITIVE_INFINITY;
    const dateB = b.created_at ? Date.parse(b.created_at) : Number.POSITIVE_INFINITY;
    return dateA - dateB;
  });
  if (!coverImageUrl || !coverBelongsToImages(coverImageUrl, sorted.map((i) => i.image_url))) {
    return sorted;
  }
  const coverIndex = sorted.findIndex((img) => img.image_url === coverImageUrl);
  if (coverIndex <= 0) return sorted;
  const cover = sorted[coverIndex];
  const remainder = sorted.filter((_, idx) => idx !== coverIndex);
  return [cover, ...remainder];
}

export function getPrimaryImageUrl(property: Property): string | null {
  const ordered = orderImagesWithCover(
    property.cover_image_url,
    property.images as MinimalImage[] | undefined
  );
  const firstImage = ordered[0];
  if (firstImage) {
    return resolvePropertyImageUrl(firstImage, "card") ?? firstImage.image_url;
  }
  return property.cover_image_url ?? null;
}
