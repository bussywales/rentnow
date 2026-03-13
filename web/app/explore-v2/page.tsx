export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { ExploreV2Feed } from "@/components/explore-v2/ExploreV2Feed";
import { AnalyticsNoticeBanner } from "@/components/tenant/AnalyticsNoticeBanner";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { getExploreFeed } from "@/lib/explore/explore-feed.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";
import { getMarketSettings } from "@/lib/market/market.server";
import { getExploreV2CtaCopyVariant, isExploreV2TrustCueEnabled } from "@/lib/settings/explore";
import type { ExploreV2CtaCopyVariant } from "@/lib/explore/explore-presentation";
import type { Property } from "@/lib/types";

type ExploreV2PageData = {
  listings: Property[];
  marketCountry: string;
  marketCurrency: string;
  viewerIsAuthenticated: boolean;
  trustCueEnabled: boolean;
  ctaCopyVariant: ExploreV2CtaCopyVariant;
};

type ExploreV2PageDependencies = {
  readHeaders: () => Promise<Headers>;
  readCookies: () => Promise<{ get: (name: string) => { value?: string } | undefined }>;
  loadMarketSettings: typeof getMarketSettings;
  loadExploreFeed: typeof getExploreFeed;
  loadAuthUser: typeof getServerAuthUser;
  loadTrustCueEnabled: typeof isExploreV2TrustCueEnabled;
  loadCtaCopyVariant: typeof getExploreV2CtaCopyVariant;
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
  const loadTrustCueEnabled = overrides.loadTrustCueEnabled ?? isExploreV2TrustCueEnabled;
  const loadCtaCopyVariant = overrides.loadCtaCopyVariant ?? getExploreV2CtaCopyVariant;

  const [requestHeaders, cookieStore, marketSettings, authUser, trustCueEnabled, ctaCopyVariant] = await Promise.all([
    readHeaders(),
    readCookies(),
    loadMarketSettings(),
    loadAuthUser(),
    loadTrustCueEnabled(),
    loadCtaCopyVariant(),
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
    trustCueEnabled,
    ctaCopyVariant,
  };
}

export default async function ExploreV2Page() {
  const pageData = await resolveExploreV2PageData();

  return (
    <main className="mx-auto w-full max-w-xl px-3 pb-12 pt-4" data-testid="explore-v2-page">
      <AnalyticsNoticeBanner />
      <ExploreV2Feed
        listings={pageData.listings}
        marketCountry={pageData.marketCountry}
        marketCurrency={pageData.marketCurrency}
        viewerIsAuthenticated={pageData.viewerIsAuthenticated}
        trustCueEnabled={pageData.trustCueEnabled}
        ctaCopyVariant={pageData.ctaCopyVariant}
      />
    </main>
  );
}
