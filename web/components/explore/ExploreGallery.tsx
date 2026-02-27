"use client";

import { useMemo } from "react";
import { UnifiedImageCarousel } from "@/components/ui/UnifiedImageCarousel";
import { resolvePropertyImageSources } from "@/components/properties/PropertyImageCarousel";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import type { Property } from "@/lib/types";

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80";

type ExploreGalleryProps = {
  property: Property;
  prioritizeFirstImage?: boolean;
};

export function ExploreGallery({ property, prioritizeFirstImage = false }: ExploreGalleryProps) {
  const imageSources = useMemo(
    () =>
      resolvePropertyImageSources({
        coverImageUrl: property.cover_image_url,
        images: property.images,
        primaryImageUrl: getPrimaryImageUrl(property),
        fallbackImage: FALLBACK_IMAGE,
      }),
    [property]
  );

  const items = useMemo(
    () =>
      imageSources.map((imageUrl, index) => ({
        id: `${property.id}-explore-${index}`,
        src: imageUrl,
        alt: property.title,
      })),
    [imageSources, property.id, property.title]
  );

  return (
    <UnifiedImageCarousel
      items={items}
      fallbackImage={FALLBACK_IMAGE}
      blurDataURL={BLUR_DATA_URL}
      sizes="100vw"
      className="h-full w-full bg-slate-900"
      imageClassName="object-cover"
      slideClassName="h-full"
      rootTestId="explore-gallery"
      dotsTestId="explore-gallery-dots"
      showArrows={false}
      showDots={false}
      showCountBadge={items.length > 1}
      prioritizeFirstImage={prioritizeFirstImage}
    />
  );
}
