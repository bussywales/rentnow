"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import {
  UnifiedImageCarousel,
  type UnifiedImageCarouselItem,
} from "@/components/ui/UnifiedImageCarousel";
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
import { glassSurface } from "@/lib/ui/glass";

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

export const EXPLORE_V2_QUIET_OVERLAY_FOCUS_MS = 2600;
export const EXPLORE_V2_QUIET_OVERLAY_OPACITY_CLASS = "opacity-[0.85]";

type ExploreV2OverlayFocusControllerOptions = {
  focusDurationMs?: number;
  onChange: (focused: boolean) => void;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timerId: ReturnType<typeof setTimeout>) => void;
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

export function resolveExploreV2OverlayOpacityClass(overlayFocused: boolean): string {
  return overlayFocused ? "opacity-100" : EXPLORE_V2_QUIET_OVERLAY_OPACITY_CLASS;
}

export function createExploreV2OverlayFocusController({
  focusDurationMs = EXPLORE_V2_QUIET_OVERLAY_FOCUS_MS,
  onChange,
  setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer = (timerId) => clearTimeout(timerId),
}: ExploreV2OverlayFocusControllerOptions) {
  const duration = Number.isFinite(focusDurationMs) ? Math.max(0, Math.trunc(focusDurationMs)) : 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let focused = false;

  const setFocused = (next: boolean) => {
    if (focused === next) return;
    focused = next;
    onChange(next);
  };

  return {
    trigger() {
      setFocused(true);
      if (timerId !== null) {
        clearTimer(timerId);
      }
      timerId = setTimer(() => {
        timerId = null;
        setFocused(false);
      }, duration);
    },
    dispose() {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
      }
    },
    isFocused() {
      return focused;
    },
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

function ExploreV2CardInner({
  listing,
  marketCurrency,
  imageRecords,
  index = 0,
  feedSize = 0,
}: ExploreV2CardProps) {
  const [ctaSheetOpen, setCtaSheetOpen] = useState(false);
  const [overlayFocused, setOverlayFocused] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"copied" | "shared" | "error" | null>(null);
  const overlayFocusController = useMemo(
    () =>
      createExploreV2OverlayFocusController({
        onChange: setOverlayFocused,
      }),
    []
  );
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
  const overlayOpacityClass = useMemo(
    () => resolveExploreV2OverlayOpacityClass(overlayFocused),
    [overlayFocused]
  );
  const showFeaturedVideoBadge = listing.featured_media === "video";

  useEffect(() => {
    return () => {
      overlayFocusController.dispose();
    };
  }, [overlayFocusController]);

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

  const handleHeroInteractionCapture = useCallback(() => {
    overlayFocusController.trigger();
  }, [overlayFocusController]);

  return (
    <>
      <article
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
        data-testid="explore-v2-card"
      >
        <div
          className="relative aspect-[4/5] min-h-[320px] w-full overflow-hidden"
          data-testid="explore-v2-hero"
          onPointerDownCapture={handleHeroInteractionCapture}
          onTouchStartCapture={handleHeroInteractionCapture}
          onFocusCapture={handleHeroInteractionCapture}
        >
          <UnifiedImageCarousel
            items={heroCarousel.items}
            fallbackImage={EXPLORE_GALLERY_FALLBACK_IMAGE}
            sizes="(max-width: 768px) 100vw, 460px"
            className="h-full w-full"
            rootTestId="explore-v2-hero-carousel"
            dotsTestId="explore-v2-hero-carousel-dots"
            showArrows={false}
            showDots={heroUiState.showDots}
            dotsClassName="bottom-3"
            showCountBadge={heroUiState.showCountBadge}
            countBadgeClassName={glassSurface("right-4 top-4 px-2.5 py-0.5 text-white")}
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
          {showFeaturedVideoBadge ? (
            <span
              className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/72 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
              data-testid="explore-v2-video-badge"
            >
              Video
            </span>
          ) : null}
          <div className="pointer-events-none absolute inset-0 z-20">
            <div
              className={cn(
                "pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-3 transition-opacity duration-200 ease-out motion-reduce:transition-none focus-within:opacity-100",
                overlayOpacityClass
              )}
              data-testid="explore-v2-action-rail"
            >
              <div
                className={glassSurface("inline-flex h-11 w-11 items-center justify-center p-0.5")}
                data-testid="explore-v2-save-surface"
              >
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
                  className="mx-auto h-10 w-10 rounded-full border-transparent bg-transparent text-white ring-0 shadow-none hover:bg-white/10 hover:text-white"
                />
              </div>
              <div
                className={glassSurface("inline-flex h-11 w-11 items-center justify-center p-0.5")}
                data-testid="explore-v2-share-surface"
              >
                <button
                  type="button"
                  onClick={() => {
                    void handleShare();
                  }}
                  className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold text-white"
                  aria-label="Share listing"
                  data-testid="explore-v2-share-action"
                >
                  ↗
                </button>
              </div>
            </div>
            <div
              className={cn(
                "pointer-events-auto absolute bottom-16 right-4 transition-opacity duration-200 ease-out motion-reduce:transition-none focus-within:opacity-100",
                overlayOpacityClass
              )}
              data-testid="explore-v2-cta-container"
            >
              <button
                type="button"
                onClick={openCtaSheet}
                className={glassSurface(
                  "inline-flex h-10 min-w-[112px] max-w-[156px] items-center justify-center px-3.5 text-xs font-semibold"
                )}
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
