import {
  shouldBypassNextImageOptimizer,
  shouldUpgradeImageUrlToHttps,
} from "@/lib/images/optimizer-bypass";
import { resolveImagePlaceholder, type PlaceholderSource } from "@/lib/images/placeholders";
import type { PropertyImage } from "@/lib/types";

export const EXPLORE_GALLERY_FALLBACK_IMAGE = "/og-propatyhub.png";

type PropertyWithImageRelations = {
  images?: PropertyImage[] | null;
  property_images?: PropertyImage[] | null;
  cover_image_url?: string | null;
};

export type ExploreImagePlaceholderMeta = {
  dominantColor: string;
  blurDataURL: string;
  source: PlaceholderSource;
};

export type ExploreHeroImageMeta = {
  blurhash: string | null;
  dominantColor: string | null;
};

export type ExploreHeroImageResolution = {
  url: string | null;
  meta: ExploreHeroImageMeta | null;
};

export function resolveExplorePropertyImageRecords(
  property: PropertyWithImageRelations | null | undefined
): PropertyImage[] {
  if (!property) return [];
  const primaryImages = Array.isArray(property.images) ? property.images : [];
  const relationImages = Array.isArray(property.property_images) ? property.property_images : [];
  const merged = [...primaryImages, ...relationImages];
  if (!merged.length) return [];

  const deduped = new Map<string, PropertyImage>();
  for (const image of merged) {
    if (!image || typeof image.image_url !== "string") continue;
    const key = image.id || image.image_url;
    if (!key || deduped.has(key)) continue;
    deduped.set(key, image);
  }
  return Array.from(deduped.values());
}

export function resolveExploreImagePlaceholderMeta(input: {
  imageUrl: string | null | undefined;
  imageRecord?: PropertyImage | null;
}): ExploreImagePlaceholderMeta {
  const imageRecord = input.imageRecord ?? null;
  const resolved = resolveImagePlaceholder({
    imageUrl: input.imageUrl,
    blurhash: imageRecord?.blurhash ?? null,
    dominantColor: imageRecord?.dominant_color ?? imageRecord?.dominantColor ?? null,
  });
  return {
    dominantColor: resolved.dominantColor,
    blurDataURL: resolved.blurDataURL,
    source: resolved.source,
  };
}

export function normalizeExploreGalleryImageUrl(
  rawUrl: string | null | undefined,
  fallbackImage: string = EXPLORE_GALLERY_FALLBACK_IMAGE
): string {
  if (typeof rawUrl !== "string") return fallbackImage;
  const trimmed = rawUrl.trim();
  if (!trimmed) return fallbackImage;
  if (trimmed.startsWith("/")) return trimmed;

  const normalizedCandidate = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  try {
    const parsed = new URL(normalizedCandidate);
    if (parsed.protocol === "https:") return parsed.toString();
    if (parsed.protocol === "http:" && shouldUpgradeImageUrlToHttps(parsed.toString())) {
      parsed.protocol = "https:";
      return parsed.toString();
    }
    if (shouldBypassNextImageOptimizer(parsed.toString())) return parsed.toString();
    return fallbackImage;
  } catch {
    return fallbackImage;
  }
}

export function resolveExploreHeroImageUrl(
  property: PropertyWithImageRelations | null | undefined
): ExploreHeroImageResolution {
  if (!property) {
    return { url: null, meta: null };
  }

  const records = resolveExplorePropertyImageRecords(property);
  for (const record of records) {
    const normalizedUrl = normalizeExploreGalleryImageUrl(record.image_url, "");
    if (!normalizedUrl) continue;
    return {
      url: normalizedUrl,
      meta: {
        blurhash: record.blurhash ?? null,
        dominantColor: record.dominant_color ?? record.dominantColor ?? null,
      },
    };
  }

  const normalizedCoverUrl = normalizeExploreGalleryImageUrl(property.cover_image_url, "");
  if (normalizedCoverUrl) {
    return {
      url: normalizedCoverUrl,
      meta: null,
    };
  }

  return { url: null, meta: null };
}

export function shouldRenderExploreGalleryImage(
  imageIndex: number,
  activeIndex: number,
  totalImages: number,
  windowRadius: number = 1
): boolean {
  if (totalImages <= 1) return true;
  return Math.abs(imageIndex - activeIndex) <= Math.max(0, windowRadius);
}

export function resolveExploreGalleryDisplaySource(input: {
  imageUrl: string;
  imageIndex: number;
  activeIndex: number;
  totalImages: number;
  failedIndexes: Set<number>;
  fallbackImage?: string;
  windowRadius?: number;
}): string {
  const fallbackImage = input.fallbackImage ?? EXPLORE_GALLERY_FALLBACK_IMAGE;
  if (input.failedIndexes.has(input.imageIndex)) return fallbackImage;
  if (
    !shouldRenderExploreGalleryImage(
      input.imageIndex,
      input.activeIndex,
      input.totalImages,
      input.windowRadius
    )
  ) {
    return fallbackImage;
  }
  return input.imageUrl;
}
