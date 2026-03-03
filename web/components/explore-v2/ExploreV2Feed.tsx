"use client";

import { memo, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";
import type { Property } from "@/lib/types";
import { ExploreV2Card } from "@/components/explore-v2/ExploreV2Card";

type ExploreV2FeedProps = {
  listings: Property[];
  marketCurrency: string | null;
};

function ExploreV2FeedInner({ listings, marketCurrency }: ExploreV2FeedProps) {
  const renderCard = useCallback(
    (index: number, listing: Property) => (
      <div className={index === 0 ? "pt-1 pb-4" : "pb-4"}>
        <ExploreV2Card listing={listing} marketCurrency={marketCurrency} />
      </div>
    ),
    [marketCurrency]
  );

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
        itemContent={renderCard}
      />
    </section>
  );
}

export const ExploreV2Feed = memo(ExploreV2FeedInner);
