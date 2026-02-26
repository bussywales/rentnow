"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { TrackViewedLink } from "@/components/viewed/TrackViewedLink";
import { getMotionSafeScrollBehavior } from "@/lib/a11y/reduced-motion";
import { getDiscoveryCatalogueItemById, resolveDiscoveryTrustBadges } from "@/lib/discovery";
import {
  clearViewedItems,
  getViewedItems,
  subscribeViewedItems,
  type ViewedItemRecord,
} from "@/lib/viewed";

type DisplayItem = {
  item: ViewedItemRecord;
  badges: ReturnType<typeof resolveDiscoveryTrustBadges>;
};

export function MobileRecentlyViewedRail() {
  const { market } = useMarketPreference();
  const [items, setItems] = useState<ViewedItemRecord[]>([]);

  useEffect(() => {
    const refresh = () =>
      setItems(
        getViewedItems({
          marketCountry: market.country,
          limit: 8,
        })
      );

    const frame = window.requestAnimationFrame(refresh);
    const unsubscribe = subscribeViewedItems(refresh);
    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [market.country]);

  const displayItems = useMemo<DisplayItem[]>(
    () =>
      items.map((item) => {
        const catalogueItem = getDiscoveryCatalogueItemById(item.id);
        return {
          item,
          badges: catalogueItem
            ? resolveDiscoveryTrustBadges({
                item: catalogueItem,
              })
            : [],
        };
      }),
    [items]
  );
  if (!displayItems.length) return null;

  const onRailKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const step = Math.max(220, Math.round(node.clientWidth * 0.82));
    if (event.key === "ArrowRight") {
      event.preventDefault();
      node.scrollBy({ left: step, behavior: getMotionSafeScrollBehavior("smooth") });
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      node.scrollBy({ left: -step, behavior: getMotionSafeScrollBehavior("smooth") });
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      node.scrollTo({ left: 0, behavior: getMotionSafeScrollBehavior("smooth") });
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      node.scrollTo({ left: node.scrollWidth, behavior: getMotionSafeScrollBehavior("smooth") });
    }
  };

  return (
    <section
      className="space-y-2 overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:hidden"
      data-testid="mobile-recently-viewed-rail"
      data-market-country={market.country}
      role="region"
      aria-label={`Recently viewed for ${market.country}`}
    >
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recently viewed</p>
          <h2 className="text-base font-semibold text-slate-900">Continue where you left off</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/saved" className="text-xs font-semibold text-sky-700 hover:text-sky-800">
            Saved
          </Link>
          <button
            type="button"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            data-testid="mobile-recently-viewed-clear"
            aria-label="Clear recently viewed items"
            onClick={() => {
              clearViewedItems({ marketCountry: market.country });
            }}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-white to-transparent" />
        <div
          className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 pr-5 scroll-px-5 scroll-smooth motion-reduce:scroll-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          data-testid="mobile-recently-viewed-scroll"
          tabIndex={0}
          aria-label="Recently viewed carousel"
          onKeyDown={onRailKeyDown}
        >
          {displayItems.map(({ item, badges }) => (
            <TrackViewedLink
              key={`${item.marketCountry}:${item.kind}:${item.id}`}
              href={item.href}
              viewedItem={{
                id: item.id,
                kind: item.kind,
                href: item.href,
                title: item.title,
                subtitle: item.subtitle,
                tag: item.tag,
                marketCountry: item.marketCountry,
              }}
              data-testid="mobile-recently-viewed-item"
              className="inline-flex w-[235px] shrink-0 snap-start snap-always flex-col gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 shadow-sm"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {item.tag ?? (item.kind === "shortlet" ? "Shortlets" : "Properties")}
              </span>
              <TrustBadges badges={badges} marketCountry={item.marketCountry} />
              <p className="line-clamp-2 text-sm font-semibold">
                {item.title?.trim() || "Listing"}
              </p>
              {item.subtitle ? <p className="line-clamp-2 text-xs text-slate-600">{item.subtitle}</p> : null}
              <span className="pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                Open
              </span>
            </TrackViewedLink>
          ))}
          <div className="w-5 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
