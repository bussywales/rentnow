export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { ExplorePager } from "@/components/explore/ExplorePager";
import { AnalyticsNoticeBanner } from "@/components/tenant/AnalyticsNoticeBanner";
import { getSectionedExploreFeed } from "@/lib/explore/explore-feed.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";
import { getMarketSettings } from "@/lib/market/market.server";

export const metadata: Metadata = {
  title: "Explore Labs",
  description: "Experimental explore feed with lightweight pager controls.",
};

export default async function ExploreLabsPage() {
  const [requestHeaders, cookieStore, marketSettings] = await Promise.all([
    headers(),
    cookies(),
    getMarketSettings(),
  ]);
  const market = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: cookieStore.get(MARKET_COOKIE_NAME)?.value ?? null,
    appSettings: marketSettings,
  });
  const sectionedFeed = await getSectionedExploreFeed({ limit: 20, marketCountry: market.country });

  return (
    <div className="fixed inset-0 z-20 overflow-hidden overscroll-none bg-slate-950" data-testid="explore-labs-shell">
      <div className="mx-auto h-full w-full max-w-xl overflow-hidden px-2 md:px-4" data-testid="explore-labs-page">
        <AnalyticsNoticeBanner />
        <ExplorePager
          listings={[...sectionedFeed.marketPicks, ...sectionedFeed.moreToExplore]}
          sectionMeta={sectionedFeed.meta}
          marketPickIds={sectionedFeed.marketPicks.map((listing) => listing.id)}
          moreToExploreIds={sectionedFeed.moreToExplore.map((listing) => listing.id)}
          pagerEngine="lite"
        />
      </div>
    </div>
  );
}
