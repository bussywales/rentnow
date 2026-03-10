"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type ListRange } from "react-virtuoso";
import type { Property } from "@/lib/types";
import {
  ExploreV2Header,
  createExploreV2DefaultFilters,
  normalizeExploreV2MarketFilter,
  type ExploreV2Filters,
} from "@/components/explore-v2/ExploreV2Header";
import { ExploreV2Card, resolveExploreV2CarouselItems } from "@/components/explore-v2/ExploreV2Card";
import { resolveExplorePropertyImageRecords } from "@/lib/explore/gallery-images";
import {
  resolveExploreAnalyticsIntentType,
  resolveExploreListingMarketCountry,
} from "@/lib/explore/explore-presentation";
import { resolveExploreV2PrefetchLookahead, subscribeToConserveDataChanges } from "@/lib/explore/network-hints";

type ExploreV2FeedProps = {
  listings: Property[];
  marketCountry: string | null;
  marketCurrency: string | null;
  viewerIsAuthenticated?: boolean;
  trustCueEnabled?: boolean;
};

export const EXPLORE_V2_PRELOAD_MAX_INFLIGHT = 2;
export const EXPLORE_V2_PREFETCH_MAX_LOOKAHEAD = 1;
export const EXPLORE_V2_PREFETCH_SESSION_CAP = 20;
export const EXPLORE_V2_DOCK_SAFE_ZONE_PX = 136;
export const EXPLORE_V2_PREFETCH_ENABLED =
  process.env.NEXT_PUBLIC_EXPLORE_V2_PREFETCH_ENABLED !== "false";

type ExploreV2PrefetchPlanInput = {
  topVisibleIndex: number;
  totalListings: number;
  heroImageUrls: ReadonlyArray<string | null | undefined>;
  lookaheadCount: number;
  maxInflight: number;
  sessionCap: number;
  completedUrls: ReadonlySet<string>;
  inflightUrls: ReadonlySet<string>;
};

export function resolveExploreV2HeroPrefetchPlan(input: ExploreV2PrefetchPlanInput): string[] {
  if (input.totalListings < 2) return [];
  if (input.lookaheadCount <= 0) return [];
  if (input.maxInflight <= 0) return [];
  if (input.sessionCap <= 0) return [];
  const completedCount = input.completedUrls.size;
  const inflightCount = input.inflightUrls.size;
  if (completedCount >= input.sessionCap) return [];
  if (inflightCount >= input.maxInflight) return [];

  const safeTopIndex = Math.max(0, Math.min(input.totalListings - 1, input.topVisibleIndex));
  const plan: string[] = [];
  const selected = new Set<string>();
  const maxLookahead = Math.max(0, Math.min(EXPLORE_V2_PREFETCH_MAX_LOOKAHEAD, input.lookaheadCount));

  for (let offset = 1; offset <= maxLookahead; offset += 1) {
    const candidateIndex = safeTopIndex + offset;
    if (candidateIndex >= input.totalListings) break;

    const candidateUrl = input.heroImageUrls[candidateIndex];
    if (!candidateUrl || typeof candidateUrl !== "string") continue;
    const normalizedUrl = candidateUrl.trim();
    if (!normalizedUrl) continue;
    if (input.completedUrls.has(normalizedUrl)) continue;
    if (input.inflightUrls.has(normalizedUrl)) continue;
    if (selected.has(normalizedUrl)) continue;
    if (completedCount + inflightCount + plan.length >= input.sessionCap) break;
    if (inflightCount + plan.length >= input.maxInflight) break;

    plan.push(normalizedUrl);
    selected.add(normalizedUrl);
  }

  return plan;
}

export async function prefetchExploreV2HeroImageUrl(imageUrl: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const normalizedUrl = imageUrl.trim();
  if (!normalizedUrl) return false;

  return new Promise<boolean>((resolve) => {
    const image = new Image();
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
    };
    image.onload = () => {
      cleanup();
      resolve(true);
    };
    image.onerror = () => {
      cleanup();
      resolve(false);
    };
    image.decoding = "async";
    image.src = normalizedUrl;
  });
}

type ExploreV2ListingFilterInput = {
  listings: ReadonlyArray<Property>;
  filters: ExploreV2Filters;
  fallbackMarketCountry: string | null;
};

function resolveBedsMinimum(filter: ExploreV2Filters["beds"]): number | null {
  if (filter === "any") return null;
  const parsed = Number.parseInt(filter, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function filterExploreV2Listings(input: ExploreV2ListingFilterInput): Property[] {
  const minimumBeds = resolveBedsMinimum(input.filters.beds);
  return input.listings.filter((listing) => {
    if (input.filters.market !== "all") {
      const listingMarket = resolveExploreListingMarketCountry(
        listing,
        input.fallbackMarketCountry
      ).toLowerCase();
      if (listingMarket !== input.filters.market) return false;
    }

    if (input.filters.type !== "all") {
      const intentType = resolveExploreAnalyticsIntentType(listing);
      if (input.filters.type === "shortlets" && intentType !== "shortlet") return false;
      if (input.filters.type === "rent" && intentType !== "rent") return false;
      if (input.filters.type === "buy" && intentType !== "buy") return false;
    }

    if (minimumBeds !== null) {
      const bedrooms = Number.isFinite(listing.bedrooms) ? listing.bedrooms : 0;
      if (bedrooms < minimumBeds) return false;
    }

    if (input.filters.market !== "all" && (input.filters.budgetMin !== null || input.filters.budgetMax !== null)) {
      const price = Number.isFinite(listing.price) ? listing.price : null;
      if (price === null) return false;
      if (input.filters.budgetMin !== null && price < input.filters.budgetMin) return false;
      if (input.filters.budgetMax !== null && price > input.filters.budgetMax) return false;
    }

    return true;
  });
}

function ExploreV2FeedInner({
  listings,
  marketCountry,
  marketCurrency,
  viewerIsAuthenticated = false,
  trustCueEnabled = false,
}: ExploreV2FeedProps) {
  const [topVisibleIndex, setTopVisibleIndex] = useState(0);
  const [prefetchLookahead, setPrefetchLookahead] = useState(() =>
    resolveExploreV2PrefetchLookahead(undefined, EXPLORE_V2_PREFETCH_MAX_LOOKAHEAD)
  );
  const defaultMarket = useMemo(
    () => normalizeExploreV2MarketFilter(marketCountry),
    [marketCountry]
  );
  const [filters, setFilters] = useState<ExploreV2Filters>(() =>
    createExploreV2DefaultFilters(defaultMarket)
  );
  const inflightPreloadUrlsRef = useRef<Set<string>>(new Set());
  const completedPreloadUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setFilters(createExploreV2DefaultFilters(defaultMarket));
  }, [defaultMarket]);

  const filteredListings = useMemo(
    () =>
      filterExploreV2Listings({
        listings,
        filters,
        fallbackMarketCountry: marketCountry,
      }),
    [filters, listings, marketCountry]
  );

  const listingImageRecordsById = useMemo(() => {
    const next = new Map<string, ReturnType<typeof resolveExplorePropertyImageRecords>>();
    filteredListings.forEach((listing) => {
      next.set(listing.id, resolveExplorePropertyImageRecords(listing));
    });
    return next;
  }, [filteredListings]);

  const heroImageUrls = useMemo(
    () =>
      filteredListings.map((listing) => {
        const imageRecords = listingImageRecordsById.get(listing.id) ?? [];
        const resolved = resolveExploreV2CarouselItems({ listing, imageRecords });
        return resolved.items[0]?.src ?? null;
      }),
    [filteredListings, listingImageRecordsById]
  );

  const renderCard = useCallback(
    (index: number, listing: Property) => {
      const imageRecords =
        listingImageRecordsById.get(listing.id) ?? resolveExplorePropertyImageRecords(listing);
      return (
        <div className={index === 0 ? "pt-1 pb-4" : "pb-4"}>
          <ExploreV2Card
            listing={listing}
            marketCurrency={marketCurrency}
            imageRecords={imageRecords}
            index={index}
            feedSize={filteredListings.length}
            viewerIsAuthenticated={viewerIsAuthenticated}
            trustCueEnabled={trustCueEnabled}
          />
        </div>
      );
    },
    [filteredListings.length, listingImageRecordsById, marketCurrency, trustCueEnabled, viewerIsAuthenticated]
  );

  const computeItemKey = useCallback((_index: number, listing: Property) => listing.id, []);

  const handleRangeChanged = useCallback((range: ListRange) => {
    setTopVisibleIndex(range.startIndex);
  }, []);

  const feedComponents = useMemo(
    () => ({
      Footer: () => (
        <div
          className="h-[136px] md:h-8"
          data-testid="explore-v2-dock-safe-zone"
          style={{ height: `${EXPLORE_V2_DOCK_SAFE_ZONE_PX}px` }}
          aria-hidden
        />
      ),
    }),
    []
  );
  const feedViewportBy = useMemo(
    () => ({ top: 600, bottom: 1200 }),
    []
  );

  useEffect(() => {
    return subscribeToConserveDataChanges(() => {
      setPrefetchLookahead(
        resolveExploreV2PrefetchLookahead(undefined, EXPLORE_V2_PREFETCH_MAX_LOOKAHEAD)
      );
    });
  }, []);

  useEffect(() => {
    if (!EXPLORE_V2_PREFETCH_ENABLED) return;
    const plan = resolveExploreV2HeroPrefetchPlan({
      topVisibleIndex,
      totalListings: filteredListings.length,
      heroImageUrls,
      lookaheadCount: prefetchLookahead,
      maxInflight: EXPLORE_V2_PRELOAD_MAX_INFLIGHT,
      sessionCap: EXPLORE_V2_PREFETCH_SESSION_CAP,
      completedUrls: completedPreloadUrlsRef.current,
      inflightUrls: inflightPreloadUrlsRef.current,
    });
    if (plan.length === 0) return;

    plan.forEach((imageUrl) => {
      inflightPreloadUrlsRef.current.add(imageUrl);
      void prefetchExploreV2HeroImageUrl(imageUrl).finally(() => {
        inflightPreloadUrlsRef.current.delete(imageUrl);
        if (completedPreloadUrlsRef.current.size >= EXPLORE_V2_PREFETCH_SESSION_CAP) return;
        completedPreloadUrlsRef.current.add(imageUrl);
      });
    });
  }, [filteredListings.length, heroImageUrls, prefetchLookahead, topVisibleIndex]);

  const handleApplyFilters = useCallback((next: ExploreV2Filters) => {
    setFilters(next);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(createExploreV2DefaultFilters(defaultMarket));
  }, [defaultMarket]);

  return (
    <section className="pb-6 md:pb-8" data-testid="explore-v2-feed">
      <ExploreV2Header
        filters={filters}
        defaultMarket={defaultMarket}
        fallbackCurrency={marketCurrency}
        onApplyFilters={handleApplyFilters}
        onClearAll={handleClearFilters}
      />
      {filteredListings.length === 0 ? (
        <div
          className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm"
          data-testid="explore-v2-feed-empty"
        >
          <p className="text-sm font-medium text-slate-600">No listings match these filters.</p>
        </div>
      ) : (
        <Virtuoso
          data={filteredListings}
          useWindowScroll
          initialItemCount={Math.min(filteredListings.length, 8)}
          increaseViewportBy={feedViewportBy}
          computeItemKey={computeItemKey}
          components={feedComponents}
          rangeChanged={handleRangeChanged}
          itemContent={renderCard}
        />
      )}
    </section>
  );
}

export const ExploreV2Feed = memo(ExploreV2FeedInner);
