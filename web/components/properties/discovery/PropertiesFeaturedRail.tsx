"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import {
  selectPropertiesFeaturedRailItems,
} from "@/lib/discovery";

const ACCENT_CLASSES = [
  "from-sky-600/95 via-cyan-500/90 to-emerald-400/80",
  "from-indigo-600/95 via-sky-500/90 to-cyan-400/80",
  "from-emerald-600/95 via-teal-500/90 to-cyan-400/80",
  "from-slate-700/95 via-slate-600/90 to-slate-500/80",
] as const;

export function PropertiesFeaturedRail() {
  const { market } = useMarketPreference();
  const featuredItems = useMemo(
    () =>
      selectPropertiesFeaturedRailItems({
        marketCountry: market.country,
        limit: 6,
      }),
    [market.country]
  );

  if (!featuredItems.length) return null;

  return (
    <section
      className="space-y-2.5 overflow-x-hidden lg:hidden"
      data-testid="properties-featured-rail"
      data-market-country={market.country}
    >
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Featured discovery
          </p>
          <h2 className="text-sm font-semibold text-slate-900">Market-aware picks for homes</h2>
        </div>
        <Link href="/properties" className="text-[11px] font-semibold text-sky-700 hover:text-sky-800">
          See all
        </Link>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-white to-transparent" />
        <div className="scrollbar-none flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 pr-4 scroll-px-4">
          {featuredItems.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              data-testid="properties-featured-item"
              className={`relative inline-flex w-[240px] shrink-0 snap-start snap-always flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br p-3.5 text-white shadow-sm ${ACCENT_CLASSES[index % ACCENT_CLASSES.length]}`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.25),transparent_45%)]" />
              <div className="relative space-y-2">
                <span className="inline-flex rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                  {item.tag}
                </span>
                <p className="line-clamp-2 text-[15px] font-semibold leading-tight">{item.title}</p>
                <p className="line-clamp-2 text-xs text-white/90">{item.subtitle}</p>
              </div>
              <span className="relative mt-4 inline-flex text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
                Explore
              </span>
            </Link>
          ))}
          <div className="w-4 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
