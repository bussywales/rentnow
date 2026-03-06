export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { ExploreV2Feed } from "@/components/explore-v2/ExploreV2Feed";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { getExploreFeed } from "@/lib/explore/explore-feed.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";
import { getMarketSettings } from "@/lib/market/market.server";
import type { Property } from "@/lib/types";

type ExploreV2PageData = {
  listings: Property[];
  marketCountry: string;
  marketCurrency: string;
  viewerIsAuthenticated: boolean;
};

type ExploreV2PageDependencies = {
  readHeaders: () => Promise<Headers>;
  readCookies: () => Promise<{ get: (name: string) => { value?: string } | undefined }>;
  loadMarketSettings: typeof getMarketSettings;
  loadExploreFeed: typeof getExploreFeed;
  loadAuthUser: typeof getServerAuthUser;
};

export const metadata: Metadata = {
  title: "Explore V2",
  description: "Experimental Instagram-style feed with native vertical scrolling and virtualisation.",
};

export async function resolveExploreV2PageData(
  overrides: Partial<ExploreV2PageDependencies> = {}
): Promise<ExploreV2PageData> {
  const readHeaders = overrides.readHeaders ?? headers;
  const readCookies = overrides.readCookies ?? cookies;
  const loadMarketSettings = overrides.loadMarketSettings ?? getMarketSettings;
  const loadExploreFeed = overrides.loadExploreFeed ?? getExploreFeed;
  const loadAuthUser = overrides.loadAuthUser ?? getServerAuthUser;

  const [requestHeaders, cookieStore, marketSettings, authUser] = await Promise.all([
    readHeaders(),
    readCookies(),
    loadMarketSettings(),
    loadAuthUser(),
  ]);
  const market = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: cookieStore.get(MARKET_COOKIE_NAME)?.value ?? null,
    appSettings: marketSettings,
  });
  const listings = await loadExploreFeed({
    limit: 36,
    marketCountry: market.country,
  });

  return {
    listings,
    marketCountry: market.country,
    marketCurrency: market.currency,
    viewerIsAuthenticated: !!authUser.user,
  };
}

export default async function ExploreV2Page() {
  const pageData = await resolveExploreV2PageData();

  return (
    <main className="mx-auto w-full max-w-xl px-3 pb-12 pt-4" data-testid="explore-v2-page">
      <ExploreV2Feed
        listings={pageData.listings}
        marketCountry={pageData.marketCountry}
        marketCurrency={pageData.marketCurrency}
        viewerIsAuthenticated={pageData.viewerIsAuthenticated}
      />
    </main>
  );
}
