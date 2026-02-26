"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { TrackViewedLink } from "@/components/viewed/TrackViewedLink";
import { getMotionSafeScrollBehavior } from "@/lib/a11y/reduced-motion";
import { buildRecommendedNextItems, type RecommendedNextItem } from "@/lib/reco";
import { getLastSearchHref } from "@/lib/search/last-search";
import { getSavedItems, subscribeSavedItems } from "@/lib/saved";
import { getLastBrowseUrl, getViewedItems, subscribeLastBrowseUrl, subscribeViewedItems } from "@/lib/viewed";

function resolveLastBrowseHref(input: {
  marketCountry: string;
  recentKind: "shortlet" | "property" | null;
}): string | null {
  const primaryKind = input.recentKind;
  const primary = primaryKind
    ? getLastBrowseUrl({
        kind: primaryKind,
        marketCountry: input.marketCountry,
      })
    : null;
  if (primary) return primary;

  const secondaryKind = primaryKind === "property" ? "shortlet" : "property";
  return getLastBrowseUrl({
    kind: secondaryKind,
    marketCountry: input.marketCountry,
  });
}

export function MobileRecommendedNextRail() {
  const { market } = useMarketPreference();
  const [items, setItems] = useState<RecommendedNextItem[]>([]);

  useEffect(() => {
    const refresh = () => {
      const savedItems = getSavedItems({
        marketCountry: market.country,
        limit: 12,
      }).map((item) => ({
        id: item.id,
        kind: item.kind,
        href: item.href,
        marketCountry: item.marketCountry,
        timestamp: item.savedAt,
      }));
      const viewedItems = getViewedItems({
        marketCountry: market.country,
        limit: 12,
      }).map((item) => ({
        id: item.id,
        kind: item.kind,
        href: item.href,
        marketCountry: item.marketCountry,
        timestamp: item.viewedAt,
      }));

      const recentKind = viewedItems[0]?.kind ?? savedItems[0]?.kind ?? null;
      const lastBrowseHref = resolveLastBrowseHref({
        marketCountry: market.country,
        recentKind,
      });

      setItems(
        buildRecommendedNextItems({
          marketCountry: market.country,
          savedItems,
          viewedItems,
          lastBrowseHref,
          lastSearchHref: getLastSearchHref(),
          limit: 6,
          seedBucket: "mobile-home-rail",
        })
      );
    };

    const frame = window.requestAnimationFrame(refresh);
    const unsubscribeSaved = subscribeSavedItems(refresh);
    const unsubscribeViewed = subscribeViewedItems(refresh);
    const unsubscribeBrowse = subscribeLastBrowseUrl(refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribeSaved();
      unsubscribeViewed();
      unsubscribeBrowse();
      window.removeEventListener("focus", refresh);
    };
  }, [market.country]);

  if (!items.length) return null;

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
      data-testid="recommended-next-rail"
      data-market-country={market.country}
      role="region"
      aria-label={`Recommended next for ${market.country}`}
    >
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended next</p>
          <h2 className="text-base font-semibold text-slate-900">Next best picks for this market</h2>
        </div>
        <Link href="/saved" className="text-xs font-semibold text-sky-700 hover:text-sky-800">
          View saved
        </Link>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-white to-transparent" />
        <div
          className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 pr-5 scroll-px-5 scroll-smooth motion-reduce:scroll-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          data-testid="recommended-next-scroll"
          tabIndex={0}
          aria-label="Recommended next carousel"
          onKeyDown={onRailKeyDown}
        >
          {items.map((item) => (
            <TrackViewedLink
              key={item.id}
              href={item.href}
              viewedItem={{
                id: item.id,
                kind: item.kind,
                href: item.href,
                title: item.title,
                subtitle: item.subtitle,
                tag: item.tag,
                marketCountry: market.country,
              }}
              data-testid="recommended-next-item"
              className="inline-flex w-[235px] shrink-0 snap-start snap-always flex-col gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 shadow-sm"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.tag}</span>
              <TrustBadges badges={item.badges} marketCountry={market.country} />
              <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
              <p className="line-clamp-2 text-xs text-slate-600">{item.subtitle}</p>
              <span
                className="pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700"
                data-testid="recommended-next-reason"
              >
                {item.reason}
              </span>
            </TrackViewedLink>
          ))}
          <div className="w-5 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
