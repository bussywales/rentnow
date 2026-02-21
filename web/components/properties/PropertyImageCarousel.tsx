"use client";

import { useMemo } from "react";
import { cn } from "@/components/ui/cn";
import {
  UnifiedImageCarousel,
  type UnifiedImageCarouselController,
} from "@/components/ui/UnifiedImageCarousel";
import { orderImagesWithCover } from "@/lib/properties/images";
import { resolvePropertyImageUrl } from "@/lib/properties/image-url";
import type { PropertyImage } from "@/lib/types";

type Props = {
  title: string;
  href?: string;
  coverImageUrl?: string | null;
  primaryImageUrl?: string | null;
  images?: PropertyImage[];
  fallbackImage: string;
  blurDataURL: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  countBadgeClassName?: string;
  rootTestId?: string;
  dotsTestId?: string;
  showDots?: boolean;
  slideClassName?: string;
  enableActiveSlideMotion?: boolean;
  onSelectedIndexChange?: (index: number) => void;
  onCarouselReady?: (controller: PropertyImageCarouselController | null) => void;
};

export type PropertyImageCarouselController = UnifiedImageCarouselController;

export function resolvePropertyImageSources({
  coverImageUrl,
  images,
  primaryImageUrl,
  fallbackImage,
}: {
  coverImageUrl?: string | null;
  images?: PropertyImage[];
  primaryImageUrl?: string | null;
  fallbackImage: string;
}): string[] {
  const ordered = orderImagesWithCover(coverImageUrl, images ?? []);
  const orderedUrls = ordered
    .map((image) => resolvePropertyImageUrl(image, "card") ?? image.image_url)
    .filter((imageUrl): imageUrl is string => typeof imageUrl === "string" && imageUrl.length > 0);
  const seededUrls = [primaryImageUrl, ...orderedUrls].filter(
    (imageUrl): imageUrl is string => typeof imageUrl === "string" && imageUrl.length > 0
  );
  const deduped = Array.from(new Set(seededUrls));
  return deduped.length > 0 ? deduped : [fallbackImage];
}

export function shouldRenderImageCountBadge(totalImages: number): boolean {
  return totalImages > 1;
}

export function PropertyImageCarousel({
  title,
  href,
  coverImageUrl,
  primaryImageUrl,
  images,
  fallbackImage,
  blurDataURL,
  sizes,
  className,
  imageClassName,
  countBadgeClassName,
  rootTestId = "property-image-carousel",
  dotsTestId,
  showDots = false,
  slideClassName,
  enableActiveSlideMotion = false,
  onSelectedIndexChange,
  onCarouselReady,
}: Props) {
  const imageSources = useMemo(
    () =>
      resolvePropertyImageSources({
        coverImageUrl,
        images,
        primaryImageUrl,
        fallbackImage,
      }),
    [coverImageUrl, images, primaryImageUrl, fallbackImage]
  );

  const carouselItems = useMemo(
    () =>
      imageSources.map((source, index) => ({
        id: `${source}-${index}`,
        src: source,
        alt: title,
      })),
    [imageSources, title]
  );

  return (
    <UnifiedImageCarousel
      items={carouselItems}
      href={href}
      fallbackImage={fallbackImage}
      sizes={sizes}
      blurDataURL={blurDataURL}
      className={cn("h-full", className)}
      imageClassName={imageClassName}
      slideClassName={slideClassName}
      countBadgeClassName={cn("top-14", countBadgeClassName)}
      showCountBadge={shouldRenderImageCountBadge(carouselItems.length)}
      showArrows={shouldRenderImageCountBadge(carouselItems.length)}
      showDots={showDots}
      rootTestId={rootTestId}
      dotsTestId={dotsTestId}
      enableActiveSlideMotion={enableActiveSlideMotion}
      onSelectedIndexChange={onSelectedIndexChange}
      onCarouselReady={onCarouselReady}
    />
  );
}
