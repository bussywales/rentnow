"use client";

import Link from "next/link";
import { useMemo, type KeyboardEvent } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { SaveToggle } from "@/components/saved/SaveToggle";
import { HorizontalSnapRail } from "@/components/ui/HorizontalSnapRail";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { TrackViewedLink } from "@/components/viewed/TrackViewedLink";
import { getMotionSafeScrollBehavior } from "@/lib/a11y/reduced-motion";
import {
  selectPropertiesFeaturedRailItems,
} from "@/lib/discovery";
import { formatListingTitle } from "@/lib/ui/format-listing-title";

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
      className="space-y-2.5 overflow-x-hidden lg:hidden"
      data-testid="properties-featured-rail"
      data-market-country={market.country}
      role="region"
      aria-label={`Featured property picks for ${market.country}`}
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
        <HorizontalSnapRail
          scrollerClassName="px-4 pb-1 pr-4 scroll-px-4 motion-reduce:scroll-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          trackClassName="gap-2.5"
          scrollerProps={{
            tabIndex: 0,
            "aria-label": "Featured properties carousel",
            onKeyDown: onRailKeyDown,
          }}
        >
          {featuredItems.map((item, index) => {
            const titleText = formatListingTitle(item.title || "") || item.title || "Listing";
            return (
              <div key={item.id} className="relative w-[240px] shrink-0 snap-start snap-always">
                <SaveToggle
                  itemId={item.id}
                  kind="property"
                  href={item.href}
                  title={titleText}
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
                    kind: "property",
                    href: item.href,
                    title: titleText,
                    subtitle: item.subtitle,
                    tag: item.tag,
                    marketCountry: market.country,
                  }}
                  featuredTap={{
                    id: item.id,
                    kind: "property",
                    href: item.href,
                    label: titleText,
                    query: null,
                    marketCountry: market.country,
                  }}
                  data-testid="properties-featured-item"
                  className={`relative inline-flex h-[252px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br p-3.5 text-white shadow-sm ${ACCENT_CLASSES[index % ACCENT_CLASSES.length]}`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.25),transparent_45%)]" />
                  <div className="relative flex h-full flex-col pr-10">
                    <div className="space-y-2">
                      <span className="inline-flex rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                        {item.tag}
                      </span>
                      <TrustBadges badges={item.badges} marketCountry={market.country} tone="overlay" />
                    </div>
                    <div className="mt-auto flex min-h-[112px] flex-col justify-end">
                      <p className="line-clamp-2 text-[15px] font-semibold leading-tight">{titleText}</p>
                      <p className="mt-2 line-clamp-3 text-xs text-white/90">{item.subtitle}</p>
                      <span className="mt-4 inline-flex text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
                        Explore
                      </span>
                    </div>
                  </div>
                </TrackViewedLink>
              </div>
            );
          })}
          <div className="w-4 shrink-0" aria-hidden="true" />
        </HorizontalSnapRail>
      </div>
    </section>
  );
}
