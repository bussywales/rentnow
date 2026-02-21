"use client";

import { useMemo } from "react";
import { resolvePropertyImageSources } from "@/components/properties/PropertyImageCarousel";
import {
  UnifiedImageCarousel,
  shouldRenderUnifiedImageCarouselControls,
  shouldRenderUnifiedImageCarouselDots,
} from "@/components/ui/UnifiedImageCarousel";
import { shouldSuppressCarouselClickAfterDrag } from "@/lib/carousel/interaction";
import { resolveImageLoadingProfile } from "@/lib/images/loading-profile";
import type { PropertyImage } from "@/lib/types";

type Props = {
  title: string;
  href: string;
  coverImageUrl?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string[] | null;
  images?: PropertyImage[] | null;
  fallbackImage: string;
  prioritizeFirstImage?: boolean;
};

export function shouldRenderShortletsCarouselDots(totalImages: number): boolean {
  return shouldRenderUnifiedImageCarouselDots(totalImages);
}

export function shouldRenderShortletsCarouselArrows(totalImages: number): boolean {
  return shouldRenderUnifiedImageCarouselControls(totalImages);
}

export function shouldRenderShortletsCarouselControls(totalImages: number): boolean {
  return shouldRenderUnifiedImageCarouselControls(totalImages);
}

export function shouldSuppressShortletsCarouselNavigationAfterSwipe(pointerDistancePx: number): boolean {
  return shouldSuppressCarouselClickAfterDrag(pointerDistancePx);
}

export function resolveShortletsCarouselImageLoading(input: {
  index: number;
  prioritizeFirstImage?: boolean;
}): {
  priority: boolean;
  loading: "eager" | "lazy";
  fetchPriority: "high" | "auto";
} {
  const shouldPrioritize = Boolean(input.prioritizeFirstImage) && input.index === 0;
  return resolveImageLoadingProfile(shouldPrioritize);
}

export function resolveShortletsCarouselImageSources(input: {
  coverImageUrl?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string[] | null;
  images?: PropertyImage[] | null;
  fallbackImage: string;
}): string[] {
  const fromUrls = (input.imageUrls ?? [])
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((imageUrl, index) => ({
      id: `search-image-${index}`,
      image_url: imageUrl,
    })) satisfies PropertyImage[];

  const mergedImages = [...(input.images ?? []), ...fromUrls];
  return resolvePropertyImageSources({
    coverImageUrl: input.coverImageUrl ?? null,
    primaryImageUrl: input.primaryImageUrl ?? null,
    images: mergedImages,
    fallbackImage: input.fallbackImage,
  });
}

export function resolveShortletsCarouselIndexFromScroll(input: {
  scrollLeft: number;
  slideWidth: number;
  totalImages: number;
}): number {
  if (!Number.isFinite(input.slideWidth) || input.slideWidth <= 0) return 0;
  if (input.totalImages <= 1) return 0;
  const raw = Math.round(input.scrollLeft / input.slideWidth);
  return Math.max(0, Math.min(input.totalImages - 1, raw));
}

export function ShortletsSearchCardCarousel({
  title,
  href,
  coverImageUrl,
  primaryImageUrl,
  imageUrls,
  images,
  fallbackImage,
  prioritizeFirstImage = false,
}: Props) {
  const imageSources = useMemo(
    () =>
      resolveShortletsCarouselImageSources({
        coverImageUrl,
        primaryImageUrl,
        imageUrls,
        images,
        fallbackImage,
      }),
    [coverImageUrl, primaryImageUrl, imageUrls, images, fallbackImage]
  );

  const carouselItems = useMemo(
    () =>
      imageSources.map((source, index) => ({
        id: `shortlets-search-slide-${index}`,
        src: source,
        alt: title,
      })),
    [imageSources, title]
  );

  const showControls = shouldRenderShortletsCarouselControls(carouselItems.length);

  return (
    <UnifiedImageCarousel
      items={carouselItems}
      href={href}
      fallbackImage={fallbackImage}
      sizes="(max-width: 1024px) 100vw, (max-width: 1400px) 48vw, 33vw"
      className="h-44 w-full bg-slate-100 sm:h-48"
      rootTestId="shortlets-search-card-carousel"
      dotsTestId="shortlets-search-card-carousel-dots"
      showArrows={showControls}
      showCountBadge={showControls}
      showDots={shouldRenderShortletsCarouselDots(carouselItems.length)}
      prioritizeFirstImage={prioritizeFirstImage}
    />
  );
}
