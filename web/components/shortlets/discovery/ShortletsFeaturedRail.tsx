"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SaveToggle } from "@/components/saved/SaveToggle";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { TrackViewedLink } from "@/components/viewed/TrackViewedLink";
import {
  selectShortletsFeaturedRailItems,
} from "@/lib/discovery";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";

const ACCENT_CLASSES = [
  "from-sky-600/95 via-cyan-500/90 to-emerald-400/80",
  "from-indigo-600/95 via-sky-500/90 to-cyan-400/80",
  "from-emerald-600/95 via-teal-500/90 to-cyan-400/80",
  "from-slate-700/95 via-slate-600/90 to-slate-500/80",
] as const;

export function ShortletsFeaturedRail() {
  const { market } = useMarketPreference();
  const featuredItems = useMemo(
    () =>
      selectShortletsFeaturedRailItems({
        marketCountry: market.country,
        limit: 6,
      }),
    [market.country]
  );

  if (!featuredItems.length) return null;

  return (
    <section
      className="mt-3 space-y-2 overflow-x-hidden lg:hidden"
      data-testid="shortlets-featured-rail"
      data-market-country={market.country}
    >
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Featured shortlets
          </p>
          <h2 className="text-sm font-semibold text-slate-900">Discovery picks for your market</h2>
        </div>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-white to-transparent" />
        <div className="scrollbar-none flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 pr-4 scroll-px-4">
          {featuredItems.map((item, index) => (
            <div key={item.id} className="relative w-[235px] shrink-0 snap-start snap-always">
              <SaveToggle
                itemId={item.id}
                kind="shortlet"
                href={item.href}
                title={item.title}
                subtitle={item.subtitle}
                tag={item.tag}
                marketCountry={market.country}
                className="absolute right-2.5 top-2.5 z-[2]"
                testId={`save-toggle-${item.id}`}
              />
              <TrackViewedLink
                href={item.href}
                viewedItem={{
                  id: item.id,
                  kind: "shortlet",
                  href: item.href,
                  title: item.title,
                  subtitle: item.subtitle,
                  tag: item.tag,
                  marketCountry: market.country,
                }}
                data-testid="shortlets-featured-item"
                className={`relative inline-flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br p-3.5 text-white shadow-sm ${ACCENT_CLASSES[index % ACCENT_CLASSES.length]}`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.25),transparent_45%)]" />
                <div className="relative space-y-2 pr-10">
                  <span className="inline-flex rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                    {item.tag}
                  </span>
                  <TrustBadges badges={item.badges} marketCountry={market.country} tone="overlay" />
                  <p className="line-clamp-2 text-[15px] font-semibold leading-tight">{item.title}</p>
                  <p className="line-clamp-2 text-xs text-white/90">{item.subtitle}</p>
                </div>
                <span className="relative mt-4 inline-flex text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
                  Explore
                </span>
              </TrackViewedLink>
            </div>
          ))}
          <div className="w-4 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
