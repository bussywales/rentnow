export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { ExplorePager } from "@/components/explore/ExplorePager";
import { AnalyticsNoticeBanner } from "@/components/tenant/AnalyticsNoticeBanner";
import { getSectionedExploreFeed } from "@/lib/explore/explore-feed.server";
import { getMarketSettings } from "@/lib/market/market.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";
import { isExploreEnabled } from "@/lib/settings/explore";

export const metadata: Metadata = {
  title: "Explore",
  description: "Swipe through trending homes, shortlets, and opportunities in one immersive feed.",
};

export default async function ExplorePage() {
  const [requestHeaders, cookieStore, marketSettings, exploreEnabled] = await Promise.all([
    headers(),
    cookies(),
    getMarketSettings(),
    isExploreEnabled(),
  ]);

  if (!exploreEnabled) {
    return (
      <section
        className="mx-auto flex min-h-[60svh] w-full max-w-lg flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm"
        data-testid="explore-disabled-screen"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Explore paused
        </p>
        <h1 className="text-xl font-semibold text-slate-900">Explore is temporarily unavailable</h1>
        <p className="text-sm text-slate-600">
          We are stabilising the feed. Please browse shortlets or properties for now.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/shortlets"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Browse shortlets
          </Link>
          <Link
            href="/properties"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Browse properties
          </Link>
          <Link
            href="/explore-labs"
            className="inline-flex rounded-full border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Try Explore Labs
          </Link>
        </div>
      </section>
    );
  }

  const market = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: cookieStore.get(MARKET_COOKIE_NAME)?.value ?? null,
    appSettings: marketSettings,
  });
  const sectionedFeed = await getSectionedExploreFeed({ limit: 20, marketCountry: market.country });

  return (
    <div className="mx-auto w-full max-w-xl px-2 md:px-4" data-testid="explore-page">
      <AnalyticsNoticeBanner />
      <ExplorePager
        listings={[...sectionedFeed.marketPicks, ...sectionedFeed.moreToExplore]}
        sectionMeta={sectionedFeed.meta}
        marketPickIds={sectionedFeed.marketPicks.map((listing) => listing.id)}
        moreToExploreIds={sectionedFeed.moreToExplore.map((listing) => listing.id)}
      />
    </div>
  );
}
