"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type ListRange } from "react-virtuoso";
import type { Property } from "@/lib/types";
import { ExploreV2Card, resolveExploreV2CarouselItems } from "@/components/explore-v2/ExploreV2Card";
import { resolveExplorePropertyImageRecords } from "@/lib/explore/gallery-images";
import { resolveExploreV2PrefetchLookahead, subscribeToConserveDataChanges } from "@/lib/explore/network-hints";
import { predecodeImageUrl } from "@/lib/images/decode";

type ExploreV2FeedProps = {
  listings: Property[];
  marketCurrency: string | null;
};

export const EXPLORE_V2_PRELOAD_MAX_INFLIGHT = 2;
export const EXPLORE_V2_PREFETCH_MAX_LOOKAHEAD = 2;
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

function ExploreV2FeedInner({ listings, marketCurrency }: ExploreV2FeedProps) {
  const [topVisibleIndex, setTopVisibleIndex] = useState(0);
  const [prefetchLookahead, setPrefetchLookahead] = useState(() =>
    resolveExploreV2PrefetchLookahead(undefined, EXPLORE_V2_PREFETCH_MAX_LOOKAHEAD)
  );
  const inflightPreloadUrlsRef = useRef<Set<string>>(new Set());
  const completedPreloadUrlsRef = useRef<Set<string>>(new Set());

  const listingImageRecordsById = useMemo(() => {
    const next = new Map<string, ReturnType<typeof resolveExplorePropertyImageRecords>>();
    listings.forEach((listing) => {
      next.set(listing.id, resolveExplorePropertyImageRecords(listing));
    });
    return next;
  }, [listings]);

  const heroImageUrls = useMemo(
    () =>
      listings.map((listing) => {
        const imageRecords = listingImageRecordsById.get(listing.id) ?? [];
        const resolved = resolveExploreV2CarouselItems({ listing, imageRecords });
        return resolved.items[0]?.src ?? null;
      }),
    [listingImageRecordsById, listings]
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
            feedSize={listings.length}
          />
        </div>
      );
    },
    [listingImageRecordsById, listings.length, marketCurrency]
  );

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
      totalListings: listings.length,
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
      void predecodeImageUrl({
        imageUrl,
        maxConcurrent: EXPLORE_V2_PRELOAD_MAX_INFLIGHT,
      }).finally(() => {
        inflightPreloadUrlsRef.current.delete(imageUrl);
        if (completedPreloadUrlsRef.current.size >= EXPLORE_V2_PREFETCH_SESSION_CAP) return;
        completedPreloadUrlsRef.current.add(imageUrl);
      });
    });
  }, [heroImageUrls, listings.length, prefetchLookahead, topVisibleIndex]);

  if (listings.length === 0) {
    return (
      <section className="py-16" data-testid="explore-v2-feed">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">No listings yet for this market.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="pb-6 md:pb-8" data-testid="explore-v2-feed">
      <Virtuoso
        data={listings}
        useWindowScroll
        initialItemCount={Math.min(listings.length, 8)}
        increaseViewportBy={{ top: 600, bottom: 1200 }}
        components={feedComponents}
        rangeChanged={handleRangeChanged}
        itemContent={renderCard}
      />
    </section>
  );
}

export const ExploreV2Feed = memo(ExploreV2FeedInner);
