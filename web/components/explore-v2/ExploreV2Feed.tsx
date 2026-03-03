"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type ListRange } from "react-virtuoso";
import type { Property } from "@/lib/types";
import { ExploreV2Card } from "@/components/explore-v2/ExploreV2Card";
import {
  resolveExploreHeroImageUrl,
  resolveExplorePropertyImageRecords,
} from "@/lib/explore/gallery-images";
import {
  readShouldConserveData,
  subscribeToConserveDataChanges,
} from "@/lib/explore/network-hints";
import { predecodeImageUrl } from "@/lib/images/decode";

type ExploreV2FeedProps = {
  listings: Property[];
  marketCurrency: string | null;
};

export const EXPLORE_V2_PRELOAD_MAX_INFLIGHT = 2;

export function resolveExploreV2PreloadIndex(rangeEndIndex: number, totalListings: number): number | null {
  if (totalListings < 2) return null;
  const safeEndIndex = Math.max(0, Math.min(totalListings - 1, rangeEndIndex));
  const nextIndex = safeEndIndex + 1;
  if (nextIndex >= totalListings) return null;
  return nextIndex;
}

function ExploreV2FeedInner({ listings, marketCurrency }: ExploreV2FeedProps) {
  const [rangeEndIndex, setRangeEndIndex] = useState(0);
  const [shouldConserveDataState, setShouldConserveDataState] = useState(() =>
    readShouldConserveData()
  );
  const inflightPreloadUrlsRef = useRef<Set<string>>(new Set());
  const completedPreloadUrlsRef = useRef<Set<string>>(new Set());

  const heroImageUrls = useMemo(
    () => listings.map((listing) => resolveExploreHeroImageUrl(listing).url),
    [listings]
  );

  const preloadIndex = resolveExploreV2PreloadIndex(rangeEndIndex, listings.length);
  const nextHeroImageUrl =
    preloadIndex === null ? null : (heroImageUrls[preloadIndex] ?? null);

  const renderCard = useCallback(
    (index: number, listing: Property) => {
      const imageRecords = resolveExplorePropertyImageRecords(listing);
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
    [listings.length, marketCurrency]
  );

  const handleRangeChanged = useCallback((range: ListRange) => {
    setRangeEndIndex(range.endIndex);
  }, []);

  useEffect(() => {
    return subscribeToConserveDataChanges(setShouldConserveDataState);
  }, []);

  useEffect(() => {
    if (shouldConserveDataState) return;
    if (!nextHeroImageUrl) return;
    if (completedPreloadUrlsRef.current.has(nextHeroImageUrl)) return;
    if (inflightPreloadUrlsRef.current.has(nextHeroImageUrl)) return;
    if (inflightPreloadUrlsRef.current.size >= EXPLORE_V2_PRELOAD_MAX_INFLIGHT) return;

    inflightPreloadUrlsRef.current.add(nextHeroImageUrl);
    void predecodeImageUrl({
      imageUrl: nextHeroImageUrl,
      maxConcurrent: EXPLORE_V2_PRELOAD_MAX_INFLIGHT,
    }).finally(() => {
      inflightPreloadUrlsRef.current.delete(nextHeroImageUrl);
      completedPreloadUrlsRef.current.add(nextHeroImageUrl);
    });
  }, [nextHeroImageUrl, shouldConserveDataState]);

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
    <section className="pb-24" data-testid="explore-v2-feed">
      <Virtuoso
        data={listings}
        useWindowScroll
        initialItemCount={Math.min(listings.length, 8)}
        increaseViewportBy={{ top: 600, bottom: 1200 }}
        rangeChanged={handleRangeChanged}
        itemContent={renderCard}
      />
    </section>
  );
}

export const ExploreV2Feed = memo(ExploreV2FeedInner);
