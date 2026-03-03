"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  UnifiedImageCarousel,
  type UnifiedImageCarouselItem,
} from "@/components/ui/UnifiedImageCarousel";
import { GlassPill } from "@/components/ui/GlassPill";
import { SaveToggle } from "@/components/saved/SaveToggle";
import { trackExploreFunnelEvent, type ExploreFunnelIntent } from "@/lib/explore/explore-funnel";
import { performShare, type ShareActionResult } from "@/lib/share/client-share";
import type { Property } from "@/lib/types";
import {
  resolveExploreAnalyticsIntentType,
  resolveExploreDetailsHref,
  resolveExploreIntentTag,
  resolveExploreListingKind,
  resolveExploreListingMarketCountry,
  resolveExplorePrimaryAction,
  resolveExplorePriceCopy,
} from "@/lib/explore/explore-presentation";
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
  index?: number;
  feedSize?: number;
};

type ExploreImageRecord = ReturnType<typeof resolveExplorePropertyImageRecords>[number];

type ExploreV2ActionContext = {
  listingId: string;
  marketCode: string;
  intentType: ExploreFunnelIntent;
  index: number;
  feedSize: number;
};

type ExploreV2ShareActionInput = {
  detailsHref: string;
  title: string | null | undefined;
  locationLine: string;
  context: ExploreV2ActionContext;
};

type ExploreV2ShareActionDeps = {
  shareFn?: typeof performShare;
  trackFn?: typeof trackExploreFunnelEvent;
  origin?: string | null;
};

type ExploreV2CtaContinueInput = {
  href: string;
  context: ExploreV2ActionContext;
};

type ExploreV2CtaContinueDeps = {
  pushFn: (href: string) => void;
  trackFn?: typeof trackExploreFunnelEvent;
};

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

export function resolveExploreV2ActionContext(input: {
  listing: Property;
  index?: number;
  feedSize?: number;
}): ExploreV2ActionContext {
  const marketCode = resolveExploreListingMarketCountry(input.listing, input.listing.country_code ?? null);
  return {
    listingId: input.listing.id,
    marketCode,
    intentType: resolveExploreAnalyticsIntentType(input.listing),
    index: Number.isFinite(input.index) ? Math.max(0, input.index ?? 0) : 0,
    feedSize: Number.isFinite(input.feedSize) ? Math.max(0, input.feedSize ?? 0) : 0,
  };
}

export function trackExploreV2SaveToggle(input: {
  context: ExploreV2ActionContext;
  saved: boolean;
  trackFn?: typeof trackExploreFunnelEvent;
}) {
  const trackFn = input.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_save_toggle",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: "save",
    result: input.saved ? "saved" : "unsaved",
  });
}

export async function triggerExploreV2ShareAction(
  input: ExploreV2ShareActionInput,
  deps: ExploreV2ShareActionDeps = {}
): Promise<ShareActionResult | "error"> {
  const shareFn = deps.shareFn ?? performShare;
  const origin =
    deps.origin === undefined
      ? typeof window === "undefined"
        ? null
        : window.location.origin
      : deps.origin;
  const absoluteUrl = origin ? new URL(input.detailsHref, origin).toString() : input.detailsHref;
  const shareResult = await shareFn({
    title: input.title ?? "Explore listing",
    text: input.locationLine,
    url: absoluteUrl,
  });
  const trackFn = deps.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_share",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: "share",
    result: shareResult,
  });
  if (shareResult === "unavailable") {
    return "error";
  }
  return shareResult;
}

export function continueExploreV2Cta(
  input: ExploreV2CtaContinueInput,
  deps: ExploreV2CtaContinueDeps
) {
  const trackFn = deps.trackFn ?? trackExploreFunnelEvent;
  trackFn({
    name: "explore_v2_cta_continue",
    listingId: input.context.listingId,
    marketCode: input.context.marketCode,
    intentType: input.context.intentType,
    index: input.context.index,
    feedSize: input.context.feedSize,
    action: "continue",
    result: "navigated",
  });
  deps.pushFn(input.href);
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

function ExploreV2CardInner({
  listing,
  marketCurrency,
  imageRecords,
  index = 0,
  feedSize = 0,
}: ExploreV2CardProps) {
  const [ctaSheetOpen, setCtaSheetOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"copied" | "shared" | "error" | null>(null);
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
  const detailsHref = useMemo(() => resolveExploreDetailsHref(listing), [listing]);
  const primaryAction = useMemo(() => resolveExplorePrimaryAction(listing), [listing]);
  const listingKind = useMemo(() => resolveExploreListingKind(listing), [listing]);
  const actionContext = useMemo(
    () =>
      resolveExploreV2ActionContext({
        listing,
        index,
        feedSize,
      }),
    [feedSize, index, listing]
  );
  const intentTag = useMemo(() => resolveExploreIntentTag(listing), [listing]);
  const locationLine = useMemo(() => resolveExploreV2LocationLine(listing), [listing]);
  const shareFeedbackCopy = shareFeedback === "error" ? "Share unavailable" : "Link ready";

  const handleSaveToggle = useCallback(
    (saved: boolean) => {
      trackExploreV2SaveToggle({ context: actionContext, saved });
    },
    [actionContext]
  );

  const handleShare = useCallback(async () => {
    const result = await triggerExploreV2ShareAction({
      detailsHref,
      title: listing.title,
      locationLine,
      context: actionContext,
    });
    if (result === "shared") {
      setShareFeedback("shared");
      return;
    }
    if (result === "copied") {
      setShareFeedback("copied");
      return;
    }
    setShareFeedback("error");
  }, [actionContext, detailsHref, listing.title, locationLine]);

  const openCtaSheet = useCallback(() => {
    trackExploreFunnelEvent({
      name: "explore_v2_cta_open",
      listingId: actionContext.listingId,
      marketCode: actionContext.marketCode,
      intentType: actionContext.intentType,
      index: actionContext.index,
      feedSize: actionContext.feedSize,
      action: primaryAction.label.toLowerCase(),
    });
    setCtaSheetOpen(true);
  }, [actionContext, primaryAction.label]);

  const handleCtaContinue = useCallback(() => {
    setCtaSheetOpen(false);
    continueExploreV2Cta(
      {
        href: primaryAction.href,
        context: actionContext,
      },
      {
        pushFn: (href) => {
          if (typeof window !== "undefined") {
            window.location.assign(href);
          }
        },
      }
    );
  }, [actionContext, primaryAction.href]);

  return (
    <>
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
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-end pr-3">
            <div className="pointer-events-auto flex flex-col gap-2" data-testid="explore-v2-action-rail">
              <GlassPill variant="dark" className="h-11 w-11 p-0.5">
                <SaveToggle
                  itemId={listing.id}
                  kind={listingKind}
                  href={detailsHref}
                  title={listing.title || "Explore listing"}
                  subtitle={locationLine}
                  tag={intentTag}
                  marketCountry={actionContext.marketCode}
                  testId={`explore-v2-save-toggle-${listing.id}`}
                  onToggle={handleSaveToggle}
                  className="h-full w-full border-transparent bg-transparent text-white ring-0 shadow-none hover:bg-white/10 hover:text-white"
                />
              </GlassPill>
              <GlassPill variant="dark" className="h-11 w-11 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    void handleShare();
                  }}
                  className="inline-flex h-full w-full items-center justify-center rounded-full text-base font-semibold text-white"
                  aria-label="Share listing"
                  data-testid="explore-v2-share-action"
                >
                  ↗
                </button>
              </GlassPill>
              <button
                type="button"
                onClick={openCtaSheet}
                className="inline-flex h-11 min-w-[92px] items-center justify-center rounded-full border border-white/20 bg-slate-900/55 px-3 text-xs font-semibold text-white backdrop-blur-md backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_20px_rgba(15,23,42,0.22)]"
                aria-label={`${primaryAction.label} for ${listing.title || "listing"}`}
                data-testid="explore-v2-cta-action"
              >
                {primaryAction.label}
              </button>
            </div>
          </div>
          {shareFeedback ? (
            <span
              className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/68 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
              data-testid="explore-v2-share-feedback"
            >
              {shareFeedbackCopy}
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
      <BottomSheet
        open={ctaSheetOpen}
        onOpenChange={setCtaSheetOpen}
        title={primaryAction.label}
        description="Quick action"
        testId="explore-v2-cta-sheet"
        sheetId={`explore-v2-cta-sheet-${listing.id}`}
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900">{listing.title || "Untitled listing"}</p>
            <p className="mt-0.5 truncate text-xs text-slate-600">{locationLine}</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">{price.primary}</p>
          </div>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            onClick={handleCtaContinue}
            data-testid="explore-v2-cta-continue"
          >
            Continue
          </button>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            onClick={() => setCtaSheetOpen(false)}
            data-testid="explore-v2-cta-close"
          >
            Close
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

export const ExploreV2Card = memo(ExploreV2CardInner);
