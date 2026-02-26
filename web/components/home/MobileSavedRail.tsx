"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { getDiscoveryCatalogueItemById, resolveDiscoveryTrustBadges } from "@/lib/discovery";
import { clearSavedItems, getSavedItems, subscribeSavedItems, type SavedItemRecord } from "@/lib/saved";

export function MobileSavedRail() {
  const { market } = useMarketPreference();
  const [items, setItems] = useState<SavedItemRecord[]>(() =>
    getSavedItems({
      marketCountry: market.country,
      limit: 8,
    })
  );

  useEffect(() => {
    const refresh = () => {
      setItems(
        getSavedItems({
          marketCountry: market.country,
          limit: 8,
        })
      );
    };

    const frame = window.requestAnimationFrame(refresh);
    const unsubscribe = subscribeSavedItems(refresh);
    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [market.country]);

  const displayItems = useMemo(
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

  return (
    <section
      className="space-y-2 overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:hidden"
      data-testid="mobile-saved-rail"
      data-market-country={market.country}
    >
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Saved</p>
          <h2 className="text-base font-semibold text-slate-900">Pick up where you left off</h2>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          data-testid="mobile-saved-rail-clear"
          onClick={() => {
            clearSavedItems({ marketCountry: market.country });
          }}
        >
          Clear
        </button>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-white to-transparent" />
        <div
          className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 pr-5 scroll-px-5"
          data-testid="mobile-saved-scroll"
        >
          {displayItems.map(({ item, badges }) => (
            <Link
              key={`${item.marketCountry}:${item.id}`}
              href={item.href}
              data-testid="mobile-saved-item"
              className="inline-flex w-[235px] shrink-0 snap-start snap-always flex-col gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 shadow-sm"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {item.tag ?? (item.kind === "shortlet" ? "Shortlets" : "Properties")}
              </span>
              <TrustBadges badges={badges} marketCountry={item.marketCountry} />
              <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
              {item.subtitle ? <p className="line-clamp-2 text-xs text-slate-600">{item.subtitle}</p> : null}
              <span className="pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                Open
              </span>
            </Link>
          ))}
          <div className="w-5 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
