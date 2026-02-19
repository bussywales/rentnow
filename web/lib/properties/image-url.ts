import { PROPERTY_IMAGE_STORAGE_BUCKET } from "@/lib/properties/image-optimisation";

type ImageWithVariants = {
  image_url?: string | null;
  storage_path?: string | null;
  original_storage_path?: string | null;
  thumb_storage_path?: string | null;
  card_storage_path?: string | null;
  hero_storage_path?: string | null;
};

function normalizePublicBaseUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function resolveSupabasePublicUrlFromPath(
  path: string | null | undefined,
  bucket: string = PROPERTY_IMAGE_STORAGE_BUCKET
): string | null {
  if (!path) return null;
  const normalizedPath = path.trim();
  if (!normalizedPath) return null;
  if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")) {
    return normalizedPath;
  }
  const baseUrl = normalizePublicBaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? null
  );
  if (!baseUrl) return null;
  return `${baseUrl}/storage/v1/object/public/${bucket}/${encodeStoragePath(normalizedPath)}`;
}

export function resolvePropertyImageUrl(
  image: ImageWithVariants | null | undefined,
  variant: "thumb" | "card" | "hero" | "original" = "card"
): string | null {
  if (!image) return null;
  const fromPaths = (() => {
    if (variant === "thumb") {
      return (
        resolveSupabasePublicUrlFromPath(image.thumb_storage_path) ??
        resolveSupabasePublicUrlFromPath(image.card_storage_path)
      );
    }
    if (variant === "hero") {
      return (
        resolveSupabasePublicUrlFromPath(image.hero_storage_path) ??
        resolveSupabasePublicUrlFromPath(image.card_storage_path)
      );
    }
    if (variant === "original") {
      return (
        resolveSupabasePublicUrlFromPath(image.original_storage_path) ??
        resolveSupabasePublicUrlFromPath(image.storage_path)
      );
    }
    return (
      resolveSupabasePublicUrlFromPath(image.card_storage_path) ??
      resolveSupabasePublicUrlFromPath(image.hero_storage_path) ??
      resolveSupabasePublicUrlFromPath(image.thumb_storage_path)
    );
  })();
  if (fromPaths) return fromPaths;
  const fromOriginalPath =
    resolveSupabasePublicUrlFromPath(image.original_storage_path) ??
    resolveSupabasePublicUrlFromPath(image.storage_path);
  if (fromOriginalPath) return fromOriginalPath;
  return image.image_url ?? null;
}
