"use client";

import { useMemo, useState } from "react";
import { PropertyImageCarousel, resolvePropertyImageSources } from "@/components/properties/PropertyImageCarousel";
import type { PropertyImage } from "@/lib/types";

type Props = {
  title: string;
  href: string;
  coverImageUrl?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string[] | null;
  images?: PropertyImage[] | null;
  fallbackImage: string;
};

const BLUR_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export function shouldRenderShortletsCarouselDots(totalImages: number): boolean {
  return totalImages > 3;
}

export function shouldRenderShortletsCarouselArrows(totalImages: number): boolean {
  return totalImages > 1;
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

export function ShortletsSearchCardCarousel({
  title,
  href,
  coverImageUrl,
  primaryImageUrl,
  imageUrls,
  images,
  fallbackImage,
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const showDots = shouldRenderShortletsCarouselDots(imageSources.length);

  return (
    <div className="relative h-44 w-full sm:h-48" data-testid="shortlets-search-card-carousel">
      <PropertyImageCarousel
        title={title}
        href={href}
        coverImageUrl={coverImageUrl}
        primaryImageUrl={primaryImageUrl}
        images={images ?? []}
        fallbackImage={fallbackImage}
        blurDataURL={BLUR_DATA_URL}
        sizes="(max-width: 1024px) 100vw, (max-width: 1400px) 48vw, 33vw"
        onSelectedIndexChange={setSelectedIndex}
      />
      {showDots ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1"
          data-testid="shortlets-search-card-carousel-dots"
        >
          {imageSources.map((_, index) => (
            <span
              key={`shortlets-carousel-dot-${index}`}
              className={`h-1.5 w-1.5 rounded-full ${
                index === selectedIndex ? "bg-white" : "bg-white/55"
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
