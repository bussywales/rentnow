export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { ExplorePager } from "@/components/explore/ExplorePager";
import { AnalyticsNoticeBanner } from "@/components/tenant/AnalyticsNoticeBanner";
import { getExploreFeed } from "@/lib/explore/explore-feed.server";
import { getMarketSettings } from "@/lib/market/market.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";

export const metadata: Metadata = {
  title: "Explore",
  description: "Swipe through trending homes, shortlets, and opportunities in one immersive feed.",
};

export default async function ExplorePage() {
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
  const listings = await getExploreFeed({ limit: 20, marketCountry: market.country });

  return (
    <div className="mx-auto w-full max-w-xl px-2 md:px-4" data-testid="explore-page">
      <AnalyticsNoticeBanner />
      <ExplorePager listings={listings} />
    </div>
  );
}
