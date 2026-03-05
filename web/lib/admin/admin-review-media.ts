import { orderImagesWithCover } from "@/lib/properties/images";
import {
  resolvePropertyImageUrl,
  resolveSupabasePublicUrlFromPath,
} from "@/lib/properties/image-url";

export type AdminReviewImageRow = {
  id: string;
  image_url?: string | null;
  position?: number | null;
  created_at?: string | null;
  width?: number | null;
  height?: number | null;
  storage_path?: string | null;
  original_storage_path?: string | null;
  thumb_storage_path?: string | null;
  card_storage_path?: string | null;
  hero_storage_path?: string | null;
};

type NormalizeAdminReviewMediaInput = {
  coverImageUrl?: string | null;
  images: AdminReviewImageRow[];
};

type NormalizedAdminReviewImage = {
  id: string;
  image_url: string | null;
  width?: number | null;
  height?: number | null;
};

export function normalizeAdminReviewMedia(
  input: NormalizeAdminReviewMediaInput
): {
  coverImageUrl: string | null;
  images: NormalizedAdminReviewImage[];
} {
  const withResolvedUrls = input.images.map((image) => ({
    ...image,
    image_url:
      resolvePropertyImageUrl(image, "card") ??
      resolvePropertyImageUrl(image, "hero") ??
      resolvePropertyImageUrl(image, "original") ??
      image.image_url ??
      null,
  }));

  const sortable = withResolvedUrls
    .filter((image): image is AdminReviewImageRow & { image_url: string } =>
      Boolean(image.image_url)
    )
    .map((image) => ({
      id: image.id,
      image_url: image.image_url,
      position: image.position ?? null,
      created_at: image.created_at ?? undefined,
    }));

  const resolvedCoverImageUrl =
    resolveSupabasePublicUrlFromPath(input.coverImageUrl) ??
    input.coverImageUrl ??
    null;
  const orderedWithCover = orderImagesWithCover(resolvedCoverImageUrl, sortable);
  const orderedImageIds = new Map(
    orderedWithCover.map((image, index) => [image.id, index])
  );

  const orderedImages = withResolvedUrls
    .map((image, index) => ({ image, index }))
    .sort((a, b) => {
      const orderA = orderedImageIds.get(a.image.id);
      const orderB = orderedImageIds.get(b.image.id);
      if (typeof orderA === "number" && typeof orderB === "number") {
        return orderA - orderB;
      }
      if (typeof orderA === "number") return -1;
      if (typeof orderB === "number") return 1;
      return a.index - b.index;
    })
    .map(({ image }) => ({
      id: image.id,
      image_url: image.image_url ?? null,
      width: image.width ?? null,
      height: image.height ?? null,
    }));

  const fallbackCover = orderedImages.find((image) => image.image_url)?.image_url ?? null;

  return {
    coverImageUrl: resolvedCoverImageUrl ?? fallbackCover,
    images: orderedImages,
  };
}
