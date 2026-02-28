import { normalizeExploreGalleryImageUrl, EXPLORE_GALLERY_FALLBACK_IMAGE } from "@/lib/explore/gallery-images";
import { orderImagesWithCover, getPrimaryImageUrl } from "@/lib/properties/images";
import { resolvePropertyImageUrl } from "@/lib/properties/image-url";
import type { Property } from "@/lib/types";

type MinimalPropertyImage = {
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

export type ExploreListingImageQualityTier = "healthy" | "limited" | "empty";

export type ExploreListingImageQuality = {
  tier: ExploreListingImageQualityTier;
  usableImageCount: number;
  totalCandidateImageCount: number;
  usableImageUrls: string[];
};

function isUsableListingImageUrl(value: string, fallbackImage: string): boolean {
  if (!value || value === fallbackImage) return false;
  if (value.startsWith("/")) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function collectListingImageCandidates(property: Property): string[] {
  const orderedImages = orderImagesWithCover(
    property.cover_image_url,
    (property.images as MinimalPropertyImage[] | undefined) ?? []
  );
  const orderedUrls = orderedImages
    .map((image) => resolvePropertyImageUrl(image, "card") ?? image.image_url)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const seeded = [getPrimaryImageUrl(property), property.cover_image_url, ...orderedUrls].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
  return Array.from(new Set(seeded));
}

export function scoreExploreListingImageQuality(
  property: Property,
  fallbackImage: string = EXPLORE_GALLERY_FALLBACK_IMAGE
): ExploreListingImageQuality {
  const candidates = collectListingImageCandidates(property);
  const usableImageUrls = candidates
    .map((url) => normalizeExploreGalleryImageUrl(url, fallbackImage))
    .filter((url, index, all) => all.indexOf(url) === index)
    .filter((url) => isUsableListingImageUrl(url, fallbackImage));
  const usableImageCount = usableImageUrls.length;
  const tier: ExploreListingImageQualityTier =
    usableImageCount >= 2 ? "healthy" : usableImageCount === 1 ? "limited" : "empty";

  return {
    tier,
    usableImageCount,
    totalCandidateImageCount: candidates.length,
    usableImageUrls,
  };
}

export function partitionExploreListingsByImageQuality(listings: ReadonlyArray<Property>): {
  healthy: Property[];
  limited: Property[];
  empty: Property[];
} {
  const healthy: Property[] = [];
  const limited: Property[] = [];
  const empty: Property[] = [];

  listings.forEach((listing) => {
    const score = scoreExploreListingImageQuality(listing);
    if (score.tier === "healthy") {
      healthy.push(listing);
      return;
    }
    if (score.tier === "limited") {
      limited.push(listing);
      return;
    }
    empty.push(listing);
  });

  return { healthy, limited, empty };
}
