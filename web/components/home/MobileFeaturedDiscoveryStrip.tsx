"use client";

import Link from "next/link";
import { useMemo, type KeyboardEvent } from "react";
import { SaveToggle } from "@/components/saved/SaveToggle";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { TrackViewedLink } from "@/components/viewed/TrackViewedLink";
import { getMotionSafeScrollBehavior } from "@/lib/a11y/reduced-motion";
import {
  buildFeaturedDiscoveryHref,
  getMobileFeaturedDiscoveryItems,
} from "@/lib/home/mobile-featured-discovery";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";

const ACCENT_CLASSES = [
  "from-sky-600/95 via-cyan-500/90 to-emerald-400/80",
  "from-indigo-600/95 via-sky-500/90 to-cyan-400/80",
  "from-rose-600/95 via-orange-500/90 to-amber-400/80",
  "from-emerald-600/95 via-teal-500/90 to-cyan-400/80",
  "from-slate-700/95 via-slate-600/90 to-slate-500/80",
  "from-violet-600/95 via-fuchsia-500/90 to-pink-400/80",
] as const;

export function MobileFeaturedDiscoveryStrip() {
  const { market } = useMarketPreference();
  const featuredItems = useMemo(
    () => getMobileFeaturedDiscoveryItems({ marketCountry: market.country }),
    [market.country]
  );

  if (!featuredItems.length) return null;

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
      className="space-y-3 overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:hidden"
      data-testid="mobile-featured-strip"
      data-market-country={market.country}
      role="region"
      aria-label={`Featured discovery picks for ${market.country}`}
    >
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Featured discovery</p>
          <h2 className="text-base font-semibold text-slate-900">Start with what is trending now</h2>
        </div>
        <Link href="/properties" className="text-xs font-semibold text-sky-700 hover:text-sky-800">
          See all
        </Link>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-white to-transparent" />
        <div
          className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 pr-5 scroll-px-5 scroll-smooth motion-reduce:scroll-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          data-testid="mobile-featured-scroll"
          tabIndex={0}
          aria-label="Featured discovery carousel"
          onKeyDown={onRailKeyDown}
        >
          {featuredItems.map((item, index) => (
            <div key={item.id} className="relative w-[255px] shrink-0 snap-start snap-always">
              <SaveToggle
                itemId={item.id}
                kind={item.category === "shortlet" ? "shortlet" : "property"}
                href={buildFeaturedDiscoveryHref(item)}
                title={item.title}
                subtitle={item.subtitle}
                tag={item.tag}
                marketCountry={market.country}
                testId={`save-toggle-${item.id}`}
                className="absolute right-3 top-3 z-[2]"
              />
              <TrackViewedLink
                href={buildFeaturedDiscoveryHref(item)}
                viewedItem={{
                  id: item.id,
                  kind: item.category === "shortlet" ? "shortlet" : "property",
                  href: buildFeaturedDiscoveryHref(item),
                  title: item.title,
                  subtitle: item.subtitle,
                  tag: item.tag,
                  marketCountry: market.country,
                }}
                className={`relative inline-flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br p-4 text-white shadow-sm ${ACCENT_CLASSES[index % ACCENT_CLASSES.length]}`}
                data-testid={`mobile-featured-item-${item.id}`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.25),transparent_45%)]" />
                <div className="relative space-y-2 pr-10">
                  <span
                    className="inline-flex rounded-full border border-white/30 bg-white/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                    data-testid="mobile-featured-item"
                  >
                    {item.tag}
                  </span>
                  <TrustBadges badges={item.badges} marketCountry={market.country} tone="overlay" />
                  <p className="text-base font-semibold leading-tight" data-testid="mobile-featured-item-title">
                    {item.title}
                  </p>
                  <p className="text-xs text-white/90">{item.subtitle}</p>
                </div>
                <span className="relative mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                  Explore
                </span>
              </TrackViewedLink>
            </div>
          ))}
          <div className="w-5 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
