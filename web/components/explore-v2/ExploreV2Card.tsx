"use client";

import { memo, useMemo } from "react";
import {
  UnifiedImageCarousel,
  type UnifiedImageCarouselItem,
} from "@/components/ui/UnifiedImageCarousel";
import type { Property } from "@/lib/types";
import { resolveExploreIntentTag, resolveExplorePriceCopy } from "@/lib/explore/explore-presentation";
import {
  EXPLORE_GALLERY_FALLBACK_IMAGE,
  normalizeExploreGalleryImageUrl,
  resolveExploreImagePlaceholderMeta,
  resolveExplorePropertyImageRecords,
} from "@/lib/explore/gallery-images";

type ExploreV2CardProps = {
  listing: Property;
  marketCurrency: string | null;
  imageRecords?: ExploreImageRecord[];
};

type ExploreImageRecord = ReturnType<typeof resolveExplorePropertyImageRecords>[number];

function resolveExploreV2LocationLine(listing: Property): string {
  const parts = [listing.city, listing.country_code ?? listing.country]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (parts.length === 0) return "Location available on details";
  return parts.join(", ");
}

function resolveCreatedAtTimestamp(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return parsed;
}

export function resolveExploreV2HeroUiState(totalImages: number): {
  showSwipeAffordance: boolean;
  showDots: boolean;
  showCountBadge: boolean;
} {
  const showSwipeAffordance = totalImages > 1;
  return {
    showSwipeAffordance,
    showDots: showSwipeAffordance,
    showCountBadge: showSwipeAffordance,
  };
}

export function resolveExploreV2CarouselItems(input: {
  listing: Property;
  imageRecords: ExploreImageRecord[];
}): {
  items: UnifiedImageCarouselItem[];
  hasRealImage: boolean;
} {
  const dedupedUrls = new Set<string>();
  const orderedRecords = input.imageRecords
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      const leftPosition =
        typeof left.record.position === "number" && Number.isFinite(left.record.position)
          ? left.record.position
          : Number.POSITIVE_INFINITY;
      const rightPosition =
        typeof right.record.position === "number" && Number.isFinite(right.record.position)
          ? right.record.position
          : Number.POSITIVE_INFINITY;
      if (leftPosition !== rightPosition) return leftPosition - rightPosition;

      const leftCreatedAt = resolveCreatedAtTimestamp(left.record.created_at ?? null);
      const rightCreatedAt = resolveCreatedAtTimestamp(right.record.created_at ?? null);
      if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

      return left.index - right.index;
    });

  const items: UnifiedImageCarouselItem[] = [];
  for (const { record } of orderedRecords) {
    const normalizedUrl = normalizeExploreGalleryImageUrl(record.image_url, "");
    if (!normalizedUrl || dedupedUrls.has(normalizedUrl)) continue;
    dedupedUrls.add(normalizedUrl);
    const placeholder = resolveExploreImagePlaceholderMeta({
      imageUrl: normalizedUrl,
      imageRecord: record,
    });
    items.push({
      id: record.id,
      src: normalizedUrl,
      alt: input.listing.title || "Explore listing image",
      placeholderColor: placeholder.dominantColor,
      placeholderBlurDataURL: placeholder.blurDataURL,
      placeholderSource: placeholder.source,
    });
  }

  if (items.length > 0) {
    return {
      items,
      hasRealImage: true,
    };
  }

  const fallbackCoverUrl = normalizeExploreGalleryImageUrl(input.listing.cover_image_url, "");
  if (fallbackCoverUrl) {
    const placeholder = resolveExploreImagePlaceholderMeta({ imageUrl: fallbackCoverUrl });
    return {
      items: [
        {
          id: `${input.listing.id}-cover`,
          src: fallbackCoverUrl,
          alt: input.listing.title || "Explore listing image",
          placeholderColor: placeholder.dominantColor,
          placeholderBlurDataURL: placeholder.blurDataURL,
          placeholderSource: placeholder.source,
        },
      ],
      hasRealImage: true,
    };
  }

  return {
    items: [],
    hasRealImage: false,
  };
}

function ExploreV2CardInner({ listing, marketCurrency, imageRecords }: ExploreV2CardProps) {
  const resolvedImageRecords = useMemo(
    () => imageRecords ?? resolveExplorePropertyImageRecords(listing),
    [imageRecords, listing]
  );
  const heroCarousel = useMemo(
    () =>
      resolveExploreV2CarouselItems({
        listing,
        imageRecords: resolvedImageRecords,
      }),
    [listing, resolvedImageRecords]
  );
  const heroUiState = useMemo(
    () => resolveExploreV2HeroUiState(heroCarousel.items.length),
    [heroCarousel.items.length]
  );
  const price = useMemo(
    () => resolveExplorePriceCopy(listing, { marketCurrency, stayContext: null }),
    [listing, marketCurrency]
  );
  const intentTag = useMemo(() => resolveExploreIntentTag(listing), [listing]);
  const locationLine = useMemo(() => resolveExploreV2LocationLine(listing), [listing]);

  return (
    <article
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
      data-testid="explore-v2-card"
    >
      <div className="relative aspect-[4/5] min-h-[320px] w-full overflow-hidden" data-testid="explore-v2-hero">
        <UnifiedImageCarousel
          items={heroCarousel.items}
          fallbackImage={EXPLORE_GALLERY_FALLBACK_IMAGE}
          sizes="(max-width: 768px) 100vw, 460px"
          className="h-full w-full"
          rootTestId="explore-v2-hero-carousel"
          dotsTestId="explore-v2-hero-carousel-dots"
          showArrows={false}
          showDots={heroUiState.showDots}
          showCountBadge={heroUiState.showCountBadge}
          countBadgeClassName="border-white/18 bg-slate-900/48 px-2.5 py-0.5 text-white backdrop-blur-md backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_8px_22px_rgba(15,23,42,0.24)]"
          prioritizeFirstImage
          renderWindowRadius={1}
          progressiveUpgradeOnIdle
          maxConcurrentImageLoads={2}
          showLoadingCue={heroUiState.showSwipeAffordance}
        />
        {heroCarousel.hasRealImage ? (
          <span className="sr-only" data-testid="explore-v2-hero-has-image">
            Hero image available
          </span>
        ) : null}
        {!heroCarousel.hasRealImage ? (
          <span
            className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white"
            data-testid="explore-v2-hero-image-unavailable"
          >
            Image unavailable
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5 px-4 py-3">
        <p className="truncate text-sm font-semibold text-slate-900">{listing.title || "Untitled listing"}</p>
        <p className="truncate text-xs text-slate-500">{locationLine}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-slate-900">{price.primary}</p>
          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {intentTag}
          </span>
        </div>
      </div>
    </article>
  );
}

export const ExploreV2Card = memo(ExploreV2CardInner);
