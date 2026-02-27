import {
  shouldBypassNextImageOptimizer,
  shouldUpgradeImageUrlToHttps,
} from "@/lib/images/optimizer-bypass";

export const EXPLORE_GALLERY_FALLBACK_IMAGE = "/og-propatyhub.png";

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
