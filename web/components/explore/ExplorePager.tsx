"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { resolvePropertyImageSources } from "@/components/properties/PropertyImageCarousel";
import { ExploreSectionHeader } from "@/components/explore/ExploreSectionHeader";
import type { Property } from "@/lib/types";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import { ExploreSlide } from "@/components/explore/ExploreSlide";
import { GlassPill } from "@/components/ui/GlassPill";
import {
  clearHiddenExploreListingIds,
  getHiddenExploreListingIds,
  hideExploreListingId,
  subscribeExplorePrefs,
  unhideExploreListingId,
} from "@/lib/explore/explore-prefs";
import { resolveSimilarHomes } from "@/lib/explore/similar-homes";
import {
  EXPLORE_GALLERY_FALLBACK_IMAGE,
  resolveExplorePropertyImageRecords,
} from "@/lib/explore/gallery-images";
import { trackExploreFunnelEvent } from "@/lib/explore/explore-funnel";
import { resolveExploreAnalyticsIntentType } from "@/lib/explore/explore-presentation";
import { ExplorePagerV3 } from "@/components/explore/ExplorePagerV3";
import { readShouldConserveData } from "@/lib/explore/network-hints";
import { predecodeImageUrl } from "@/lib/images/decode";

type ExplorePagerProps = {
  listings: Property[];
  sectionMeta?: {
    marketCode: string | null;
    total: number;
    targetMinimum: number;
    appliedFallback: boolean;
    limitedResults: boolean;
  };
  marketPickIds?: string[];
  moreToExploreIds?: string[];
};

const EXPLORE_FALLBACK_IMAGE = EXPLORE_GALLERY_FALLBACK_IMAGE;
type ExploreIdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type ExploreIdleWindow = Window & {
  requestIdleCallback?: (callback: ExploreIdleCallback, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};
type ExploreImageLike = Pick<HTMLImageElement, "decoding" | "src" | "onload" | "onerror">;
type CreateExploreImage = () => ExploreImageLike;

function resolveExploreHeroImageUrl(property: Property): string {
  const propertyImages = resolveExplorePropertyImageRecords(property);
  const imageSources = resolvePropertyImageSources({
    coverImageUrl: property.cover_image_url,
    images: propertyImages,
    primaryImageUrl: getPrimaryImageUrl(property),
    fallbackImage: EXPLORE_FALLBACK_IMAGE,
  });
  return imageSources[0] ?? EXPLORE_FALLBACK_IMAGE;
}

export function resolveExploreSlideShellReady(property: Property | null | undefined): boolean {
  return Boolean(property);
}

export function resolveExploreActiveSlideIndex(
  scrollTop: number,
  viewportHeight: number,
  totalSlides: number
): number {
  if (totalSlides <= 1) return 0;
  const safeViewportHeight = Math.max(1, viewportHeight);
  const boundedIndex = Math.round(scrollTop / safeViewportHeight);
  return Math.min(totalSlides - 1, Math.max(0, boundedIndex));
}

export function resolveExploreAdjacentSlideIndexes(activeIndex: number, totalSlides: number): number[] {
  const indexes = [activeIndex + 1, activeIndex - 1];
  return indexes.filter((index) => index >= 0 && index < totalSlides);
}

export function resolveExplorePreloadSlideIndexes(activeIndex: number, totalSlides: number): number[] {
  if (totalSlides <= 0) return [];
  const indexes = [activeIndex, ...resolveExploreAdjacentSlideIndexes(activeIndex, totalSlides)];
  return Array.from(new Set(indexes)).filter((index) => index >= 0 && index < totalSlides);
}

export function resolveExplorePreloadImageUrls({
  activeIndex,
  totalSlides,
  heroImageUrls,
  alreadyPreloaded,
}: {
  activeIndex: number;
  totalSlides: number;
  heroImageUrls: string[];
  alreadyPreloaded: Set<string>;
}): string[] {
  return resolveExplorePreloadSlideIndexes(activeIndex, totalSlides)
    .map((index) => heroImageUrls[index])
    .filter((imageUrl): imageUrl is string => Boolean(imageUrl && !alreadyPreloaded.has(imageUrl)));
}

export function shouldPreloadExploreSlideImages(shouldConserveData: boolean | undefined, gestureLocked = false): boolean {
  return !shouldConserveData && !gestureLocked;
}

export function resolveExploreNextSlideIndexForPredecode(activeIndex: number, totalSlides: number): number | null {
  const nextIndex = activeIndex + 1;
  if (nextIndex < 0 || nextIndex >= totalSlides) return null;
  return nextIndex;
}

export function scheduleExplorePreloadTask(task: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const idleWindow = window as ExploreIdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const idleId = idleWindow.requestIdleCallback(
      () => {
        task();
      },
      { timeout: 180 }
    );
    return () => {
      idleWindow.cancelIdleCallback?.(idleId);
    };
  }
  const timeoutId = window.setTimeout(task, 16);
  return () => {
    window.clearTimeout(timeoutId);
  };
}

export function preloadExploreImageUrlsWithConcurrency({
  imageUrls,
  alreadyPreloaded,
  maxConcurrent = 2,
  createImage = () => new Image(),
}: {
  imageUrls: string[];
  alreadyPreloaded: Set<string>;
  maxConcurrent?: number;
  createImage?: CreateExploreImage;
}): void {
  const pending = imageUrls.filter((imageUrl) => Boolean(imageUrl) && !alreadyPreloaded.has(imageUrl));
  if (!pending.length) return;
  const concurrency = Math.max(1, Math.trunc(maxConcurrent));
  let inFlight = 0;
  const launch = () => {
    while (inFlight < concurrency && pending.length) {
      const imageUrl = pending.shift();
      if (!imageUrl || alreadyPreloaded.has(imageUrl)) continue;
      const image = createImage();
      inFlight += 1;
      alreadyPreloaded.add(imageUrl);
      const complete = () => {
        image.onload = null;
        image.onerror = null;
        inFlight = Math.max(0, inFlight - 1);
        launch();
      };
      image.decoding = "async";
      image.onload = () => {
        complete();
      };
      image.onerror = () => {
        complete();
        return null;
      };
      image.src = imageUrl;
    }
  };
  launch();
}

const ExploreProgressPill = memo(function ExploreProgressPill({
  index,
  total,
}: {
  index: number;
  total: number;
}) {
  if (total <= 1) return null;
  return (
    <GlassPill
      variant="dark"
      className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 px-2.5 py-1 text-[11px] font-medium text-white/90"
      data-testid="explore-progress"
      aria-live="polite"
    >
      {`${index + 1} / ${total}`}
    </GlassPill>
  );
});

export function resolveExploreSectionByListingId(
  listingId: string,
  sectionIds: {
    marketPickIds: Set<string>;
    moreToExploreIds: Set<string>;
  }
): "market_picks" | "more_to_explore" {
  if (sectionIds.moreToExploreIds.has(listingId)) return "more_to_explore";
  return "market_picks";
}

export function ExplorePager({
  listings,
  sectionMeta,
  marketPickIds = [],
  moreToExploreIds = [],
}: ExplorePagerProps) {
  const EXPLORE_HERO_PREDECODE_MAX_CONCURRENT = 2;
  const { market } = useMarketPreference();
  const preloadedImagesRef = useRef<Set<string>>(new Set());
  const cancelPreloadRef = useRef<(() => void) | null>(null);
  const isGestureLockedRef = useRef(false);
  const gateDebugLoggedRef = useRef(false);
  const displayedIndexRef = useRef(0);
  const feedSizeRef = useRef(0);
  const heroImageUrlsRef = useRef<string[]>([]);
  const undoTimeoutRef = useRef<number | null>(null);
  const previousSwipeIndexRef = useRef<number | null>(null);
  const trackedExploreViewRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isGestureLocked, setIsGestureLocked] = useState(false);
  const [hiddenListingIds, setHiddenListingIds] = useState<string[]>([]);
  const [undoHiddenListingId, setUndoHiddenListingId] = useState<string | null>(null);
  const hiddenListingSet = useMemo(() => new Set(hiddenListingIds), [hiddenListingIds]);
  const sectionIdSets = useMemo(
    () => ({
      marketPickIds: new Set(marketPickIds),
      moreToExploreIds: new Set(moreToExploreIds),
    }),
    [marketPickIds, moreToExploreIds]
  );
  const visibleListings = useMemo(
    () => listings.filter((property) => !hiddenListingSet.has(property.id)),
    [hiddenListingSet, listings]
  );
  const heroImageUrls = useMemo(
    () => visibleListings.map((property) => resolveExploreHeroImageUrl(property)),
    [visibleListings]
  );
  const displayedIndex = Math.min(activeIndex, Math.max(0, visibleListings.length - 1));
  const feedSize = visibleListings.length;
  const activeListing = visibleListings[displayedIndex] ?? null;
  const activeSection = activeListing
    ? resolveExploreSectionByListingId(activeListing.id, sectionIdSets)
    : "market_picks";
  const similarHomesByListingId = useMemo(() => {
    const next = new Map<string, Property[]>();
    visibleListings.forEach((property) => {
      next.set(property.id, resolveSimilarHomes(property, visibleListings));
    });
    return next;
  }, [visibleListings]);
  const shouldLogPerf =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    Boolean((window as Window & { __EXPLORE_PERF_DEBUG__?: boolean }).__EXPLORE_PERF_DEBUG__);

  if (shouldLogPerf) {
    console.count("[perf][explore-pager] render");
  }

  useEffect(() => {
    displayedIndexRef.current = displayedIndex;
    feedSizeRef.current = feedSize;
    heroImageUrlsRef.current = heroImageUrls;
  }, [displayedIndex, feedSize, heroImageUrls]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldConserveData = readShouldConserveData();
    if (shouldConserveData || isGestureLockedRef.current) return;
    const nextIndex = resolveExploreNextSlideIndexForPredecode(displayedIndex, feedSize);
    if (nextIndex === null) return;
    const nextHeroImageUrl = heroImageUrls[nextIndex];
    if (!nextHeroImageUrl || nextHeroImageUrl === EXPLORE_FALLBACK_IMAGE) return;
    const cancel = scheduleExplorePreloadTask(() => {
      if (isGestureLockedRef.current || readShouldConserveData()) return;
      void predecodeImageUrl({
        imageUrl: nextHeroImageUrl,
        maxConcurrent: EXPLORE_HERO_PREDECODE_MAX_CONCURRENT,
      });
    });
    return () => {
      cancel();
    };
  }, [displayedIndex, feedSize, heroImageUrls]);

  useEffect(() => {
    if (trackedExploreViewRef.current) return;
    trackedExploreViewRef.current = true;
    trackExploreFunnelEvent({
      name: "explore_view",
      marketCode: market.country,
      feedSize,
      depth: feedSize,
    });
  }, [feedSize, market.country]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncHiddenListingIds = () => {
      setHiddenListingIds(getHiddenExploreListingIds());
    };
    syncHiddenListingIds();
    return subscribeExplorePrefs(syncHiddenListingIds);
  }, []);

  useEffect(() => {
    if (!visibleListings.length) return;
    const previousIndex = previousSwipeIndexRef.current;
    if (previousIndex === null) {
      previousSwipeIndexRef.current = displayedIndex;
      return;
    }
    if (previousIndex === displayedIndex) return;
    const activeListing = visibleListings[displayedIndex];
    trackExploreFunnelEvent({
      name: "explore_swipe",
      marketCode: market.country,
      listingId: activeListing?.id ?? null,
      intentType: activeListing ? resolveExploreAnalyticsIntentType(activeListing) : null,
      index: displayedIndex,
      feedSize,
      depth: displayedIndex + 1,
      fromIndex: previousIndex,
      toIndex: displayedIndex,
    });
    previousSwipeIndexRef.current = displayedIndex;
  }, [displayedIndex, feedSize, market.country, visibleListings]);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        window.clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldConserveData = readShouldConserveData();
    if (!shouldPreloadExploreSlideImages(shouldConserveData, isGestureLockedRef.current)) return;
    const preloadUrls = resolveExplorePreloadImageUrls({
      activeIndex: displayedIndex,
      totalSlides: feedSize,
      heroImageUrls,
      alreadyPreloaded: preloadedImagesRef.current,
    });
    if (!preloadUrls.length) return;
    cancelPreloadRef.current?.();
    cancelPreloadRef.current = scheduleExplorePreloadTask(() => {
      if (isGestureLockedRef.current) return;
      preloadExploreImageUrlsWithConcurrency({
        imageUrls: preloadUrls,
        alreadyPreloaded: preloadedImagesRef.current,
        maxConcurrent: 2,
      });
    });
    return () => {
      cancelPreloadRef.current?.();
      cancelPreloadRef.current = null;
    };
  }, [displayedIndex, feedSize, heroImageUrls]);

  useEffect(() => {
    return () => {
      cancelPreloadRef.current?.();
      cancelPreloadRef.current = null;
      isGestureLockedRef.current = false;
    };
  }, []);

  const handleGestureLockChange = useCallback((locked: boolean) => {
    isGestureLockedRef.current = locked;
    setIsGestureLocked((current) => (current === locked ? current : locked));
    if (locked) {
      cancelPreloadRef.current?.();
      cancelPreloadRef.current = null;
      return;
    }
    const shouldConserveData = readShouldConserveData();
    if (!shouldPreloadExploreSlideImages(shouldConserveData, false)) return;
    const preloadUrls = resolveExplorePreloadImageUrls({
      activeIndex: displayedIndexRef.current,
      totalSlides: feedSizeRef.current,
      heroImageUrls: heroImageUrlsRef.current,
      alreadyPreloaded: preloadedImagesRef.current,
    });
    if (!preloadUrls.length) return;
    cancelPreloadRef.current?.();
    cancelPreloadRef.current = scheduleExplorePreloadTask(() => {
      preloadExploreImageUrlsWithConcurrency({
        imageUrls: preloadUrls,
        alreadyPreloaded: preloadedImagesRef.current,
        maxConcurrent: 2,
      });
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const resetGestureLock = () => {
      handleGestureLockChange(false);
    };
    const resetGestureLockFromVisibility = () => {
      if (document.visibilityState !== "visible") {
        resetGestureLock();
      }
    };

    window.addEventListener("blur", resetGestureLock, { passive: true });
    document.addEventListener("visibilitychange", resetGestureLockFromVisibility, { passive: true });
    return () => {
      window.removeEventListener("blur", resetGestureLock);
      document.removeEventListener("visibilitychange", resetGestureLockFromVisibility);
    };
  }, [handleGestureLockChange]);

  const handleNotInterested = useCallback((listingId: string) => {
    const hiddenIndex = visibleListings.findIndex((listing) => listing.id === listingId);
    const hiddenListing = visibleListings[hiddenIndex];
    trackExploreFunnelEvent({
      name: "explore_not_interested",
      listingId,
      marketCode: market.country,
      intentType: hiddenListing ? resolveExploreAnalyticsIntentType(hiddenListing) : null,
      index: hiddenIndex >= 0 ? hiddenIndex : undefined,
      feedSize,
      depth: hiddenIndex >= 0 ? hiddenIndex + 1 : undefined,
    });
    const nextHidden = hideExploreListingId(listingId);
    setHiddenListingIds(nextHidden);
    setUndoHiddenListingId(listingId);
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
    }
    undoTimeoutRef.current = window.setTimeout(() => {
      setUndoHiddenListingId(null);
      undoTimeoutRef.current = null;
    }, 5000);
  }, [feedSize, market.country, visibleListings]);

  const handleUndoHidden = useCallback(() => {
    if (!undoHiddenListingId) return;
    const nextHidden = unhideExploreListingId(undoHiddenListingId);
    setHiddenListingIds(nextHidden);
    setUndoHiddenListingId(null);
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  }, [undoHiddenListingId]);

  const handleSelectSimilarHome = useCallback(
    (listingId: string): boolean => {
      const targetIndex = visibleListings.findIndex((listing) => listing.id === listingId);
      if (targetIndex < 0) return false;
      setActiveIndex(targetIndex);
      return true;
    },
    [visibleListings]
  );

  const handleActiveIndexChange = useCallback(
    (nextIndex: number) => {
      const maxIndex = Math.max(0, feedSize - 1);
      const bounded = Math.min(maxIndex, Math.max(0, nextIndex));
      setActiveIndex((current) => (current === bounded ? current : bounded));
    },
    [feedSize]
  );

  const canAdvanceToIndex = useCallback((nextIndex: number) => {
    const nextListing = visibleListings[nextIndex] ?? null;
    const nextImagesCount = nextListing ? resolveExplorePropertyImageRecords(nextListing).length : 0;

    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined" && !gateDebugLoggedRef.current) {
      gateDebugLoggedRef.current = true;
      console.info("[explore][pager-v3][gate-check]", {
        index: displayedIndex,
        nextIndex,
        nextListingId: nextListing?.id ?? null,
        nextImagesCount,
      });
    }

    return Boolean(nextListing);
  }, [displayedIndex, visibleListings]);

  const handleOpenDetails = useCallback(
    ({
      listingId,
      index,
      intentType,
    }: {
      listingId: string;
      index: number;
      intentType: "shortlet" | "rent" | "buy";
    }) => {
      trackExploreFunnelEvent({
        name: "explore_open_details",
        listingId,
        marketCode: market.country,
        intentType,
        index,
        feedSize,
        depth: index + 1,
      });
    },
    [feedSize, market.country]
  );

  const handlePrimaryActionTap = useCallback(
    ({
      listingId,
      index,
      action,
      intentType,
    }: {
      listingId: string;
      index: number;
      action: "Book" | "Request viewing";
      intentType: "shortlet" | "rent" | "buy";
    }) => {
      trackExploreFunnelEvent({
        name: "explore_tap_cta",
        listingId,
        marketCode: market.country,
        intentType,
        index,
        feedSize,
        depth: index + 1,
        action,
      });
    },
    [feedSize, market.country]
  );

  const handleSaveToggle = useCallback(
    ({
      listingId,
      index,
      saved,
      intentType,
    }: {
      listingId: string;
      index: number;
      saved: boolean;
      intentType: "shortlet" | "rent" | "buy";
    }) => {
      trackExploreFunnelEvent({
        name: "explore_save_toggle",
        listingId,
        marketCode: market.country,
        intentType,
        index,
        feedSize,
        depth: index + 1,
        action: saved ? "save" : "unsave",
      });
    },
    [feedSize, market.country]
  );

  const handleShareAction = useCallback(
    ({
      listingId,
      index,
      result,
      intentType,
    }: {
      listingId: string;
      index: number;
      result: "shared" | "copied" | "dismissed" | "error";
      intentType: "shortlet" | "rent" | "buy";
    }) => {
      trackExploreFunnelEvent({
        name: "explore_share",
        listingId,
        marketCode: market.country,
        intentType,
        index,
        feedSize,
        depth: index + 1,
        result,
      });
    },
    [feedSize, market.country]
  );

  if (!listings.length) {
    return (
      <section
        className="mx-auto flex min-h-[60svh] max-w-lg flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm"
        data-testid="explore-empty"
      >
        <h1 className="text-xl font-semibold text-slate-900">Explore listings</h1>
        <p className="text-sm text-slate-600">
          We could not load the explore feed right now. Try browsing shortlets or properties.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/shortlets"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Browse shortlets
          </Link>
          <Link
            href="/properties"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Browse properties
          </Link>
        </div>
      </section>
    );
  }

  if (!visibleListings.length) {
    return (
      <section
        className="mx-auto flex min-h-[60svh] max-w-lg flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm"
        data-testid="explore-empty-hidden"
      >
        <h1 className="text-xl font-semibold text-slate-900">Listings hidden</h1>
        <p className="text-sm text-slate-600">
          You have hidden all listings in this explore feed. Restore them to keep browsing.
        </p>
        <button
          type="button"
          onClick={() => {
            clearHiddenExploreListingIds();
            setHiddenListingIds([]);
          }}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          data-testid="explore-restore-hidden"
        >
          Restore hidden listings
        </button>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-sm"
      data-testid="explore-root"
    >
      <ExploreProgressPill index={displayedIndex} total={feedSize} />
      <ExploreSectionHeader
        section={activeSection}
        limitedResults={Boolean(sectionMeta?.limitedResults && activeSection === "more_to_explore")}
      />
      <ExplorePagerV3
        totalSlides={feedSize}
        activeIndex={displayedIndex}
        onActiveIndexChange={handleActiveIndexChange}
        gestureLocked={isGestureLocked}
        canAdvanceToIndex={canAdvanceToIndex}
        testId="explore-pager"
        resolveSlideKey={(index) => visibleListings[index]?.id ?? String(index)}
        renderSlide={(index) => {
          const property = visibleListings[index];
          if (!property) return null;
          return (
            <ExploreSlide
              property={property}
              index={index}
              slideDistance={Math.abs(index - displayedIndex)}
              onGestureLockChange={handleGestureLockChange}
              onNotInterested={handleNotInterested}
              similarHomes={similarHomesByListingId.get(property.id) ?? []}
              onSelectSimilarHome={handleSelectSimilarHome}
              onOpenDetails={handleOpenDetails}
              onPrimaryActionTap={handlePrimaryActionTap}
              onSaveToggle={handleSaveToggle}
              onShareAction={handleShareAction}
              feedSize={feedSize}
            />
          );
        }}
      />
      {undoHiddenListingId ? (
        <div
          className="pointer-events-auto absolute bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur"
          data-testid="explore-hide-undo"
          aria-live="polite"
        >
          <span>Hidden listing</span>
          <button
            type="button"
            onClick={handleUndoHidden}
            className="rounded-full border border-white/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white"
          >
            Undo
          </button>
        </div>
      ) : null}
    </section>
  );
}
