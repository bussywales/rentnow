"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { resolvePropertyImageSources } from "@/components/properties/PropertyImageCarousel";
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
import { EXPLORE_GALLERY_FALLBACK_IMAGE } from "@/lib/explore/gallery-images";
import { trackExploreFunnelEvent } from "@/lib/explore/explore-funnel";
import { resolveExploreAnalyticsIntentType } from "@/lib/explore/explore-presentation";

type ExplorePagerProps = {
  listings: Property[];
};

const EXPLORE_FALLBACK_IMAGE = EXPLORE_GALLERY_FALLBACK_IMAGE;

function resolveExploreHeroImageUrl(property: Property): string {
  const imageSources = resolvePropertyImageSources({
    coverImageUrl: property.cover_image_url,
    images: property.images,
    primaryImageUrl: getPrimaryImageUrl(property),
    fallbackImage: EXPLORE_FALLBACK_IMAGE,
  });
  return imageSources[0] ?? EXPLORE_FALLBACK_IMAGE;
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

export function shouldPreloadExploreSlideImages(saveData: boolean | undefined): boolean {
  return !saveData;
}

export function ExplorePager({ listings }: ExplorePagerProps) {
  const { market } = useMarketPreference();
  const pagerRef = useRef<HTMLDivElement | null>(null);
  const preloadedImagesRef = useRef<Set<string>>(new Set());
  const undoTimeoutRef = useRef<number | null>(null);
  const previousSwipeIndexRef = useRef<number | null>(null);
  const trackedExploreViewRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [verticalScrollLocked, setVerticalScrollLocked] = useState(false);
  const [hiddenListingIds, setHiddenListingIds] = useState<string[]>([]);
  const [undoHiddenListingId, setUndoHiddenListingId] = useState<string | null>(null);
  const hiddenListingSet = useMemo(() => new Set(hiddenListingIds), [hiddenListingIds]);
  const visibleListings = useMemo(
    () => listings.filter((property) => !hiddenListingSet.has(property.id)),
    [hiddenListingSet, listings]
  );
  const heroImageUrls = useMemo(
    () => visibleListings.map((property) => resolveExploreHeroImageUrl(property)),
    [visibleListings]
  );
  const displayedIndex = Math.min(activeIndex, Math.max(0, visibleListings.length - 1));
  const similarHomesByListingId = useMemo(() => {
    const next = new Map<string, Property[]>();
    visibleListings.forEach((property) => {
      next.set(property.id, resolveSimilarHomes(property, visibleListings));
    });
    return next;
  }, [visibleListings]);

  useEffect(() => {
    if (trackedExploreViewRef.current) return;
    trackedExploreViewRef.current = true;
    trackExploreFunnelEvent({
      name: "explore_view",
      marketCode: market.country,
      feedSize: visibleListings.length,
      depth: visibleListings.length,
    });
  }, [market.country, visibleListings.length]);

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
      feedSize: visibleListings.length,
      depth: displayedIndex + 1,
      fromIndex: previousIndex,
      toIndex: displayedIndex,
    });
    previousSwipeIndexRef.current = displayedIndex;
  }, [displayedIndex, market.country, visibleListings]);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        window.clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;

    let rafId = 0;
    const syncActiveSlide = () => {
      const nextIndex = resolveExploreActiveSlideIndex(pager.scrollTop, pager.clientHeight, visibleListings.length);
      setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
    };

    syncActiveSlide();
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(syncActiveSlide);
    };
    pager.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", syncActiveSlide);

    return () => {
      cancelAnimationFrame(rafId);
      pager.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", syncActiveSlide);
    };
  }, [visibleListings.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!shouldPreloadExploreSlideImages(connection?.saveData)) return;

    for (const index of resolveExploreAdjacentSlideIndexes(displayedIndex, visibleListings.length)) {
      const imageUrl = heroImageUrls[index];
      if (!imageUrl || preloadedImagesRef.current.has(imageUrl)) continue;
      const image = new Image();
      image.decoding = "async";
      image.src = imageUrl;
      preloadedImagesRef.current.add(imageUrl);
    }
  }, [displayedIndex, heroImageUrls, visibleListings.length]);

  const handleNotInterested = useCallback((listingId: string) => {
    const hiddenIndex = visibleListings.findIndex((listing) => listing.id === listingId);
    const hiddenListing = visibleListings[hiddenIndex];
    trackExploreFunnelEvent({
      name: "explore_not_interested",
      listingId,
      marketCode: market.country,
      intentType: hiddenListing ? resolveExploreAnalyticsIntentType(hiddenListing) : null,
      index: hiddenIndex >= 0 ? hiddenIndex : undefined,
      feedSize: visibleListings.length,
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
  }, [market.country, visibleListings]);

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
      const pager = pagerRef.current;
      if (!pager) return false;
      pager.scrollTo({
        top: pager.clientHeight * targetIndex,
        behavior: "smooth",
      });
      setActiveIndex(targetIndex);
      return true;
    },
    [visibleListings]
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
      {listings.length > 1 ? (
        <GlassPill
          variant="dark"
          className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 px-2.5 py-1 text-[11px] font-medium text-white/90"
          data-testid="explore-progress"
          aria-live="polite"
        >
          {`${displayedIndex + 1} / ${listings.length}`}
        </GlassPill>
      ) : null}
      <div
        className="scrollbar-none h-[100svh] snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
        data-testid="explore-pager"
        ref={pagerRef}
        style={{ overflowY: verticalScrollLocked ? "hidden" : "auto" }}
      >
        {visibleListings.map((property, index) => (
          <ExploreSlide
            key={property.id}
            property={property}
            index={index}
            onGestureLockChange={setVerticalScrollLocked}
            onNotInterested={handleNotInterested}
            similarHomes={similarHomesByListingId.get(property.id) ?? []}
            onSelectSimilarHome={handleSelectSimilarHome}
            onOpenDetails={({ listingId, index }) => {
              trackExploreFunnelEvent({
                name: "explore_open_details",
                listingId,
                marketCode: market.country,
                intentType: resolveExploreAnalyticsIntentType(property),
                index,
                feedSize: visibleListings.length,
                depth: index + 1,
              });
            }}
            onPrimaryActionTap={({ listingId, index, action, intentType }) => {
              trackExploreFunnelEvent({
                name: "explore_tap_cta",
                listingId,
                marketCode: market.country,
                intentType,
                index,
                feedSize: visibleListings.length,
                depth: index + 1,
                action,
              });
            }}
            onSaveToggle={({ listingId, index, saved, intentType }) => {
              trackExploreFunnelEvent({
                name: "explore_save_toggle",
                listingId,
                marketCode: market.country,
                intentType,
                index,
                feedSize: visibleListings.length,
                depth: index + 1,
                action: saved ? "save" : "unsave",
              });
            }}
            onShareAction={({ listingId, index, result, intentType }) => {
              trackExploreFunnelEvent({
                name: "explore_share",
                listingId,
                marketCode: market.country,
                intentType,
                index,
                feedSize: visibleListings.length,
                depth: index + 1,
                result,
              });
            }}
            feedSize={visibleListings.length}
          />
        ))}
      </div>
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
