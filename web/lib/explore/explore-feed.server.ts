import { DEV_MOCKS } from "@/lib/env";
import { mockProperties } from "@/lib/mock";
import { searchProperties } from "@/lib/search";
import { parseFiltersFromSearchParams } from "@/lib/search-filters";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

type ExploreFeedInput = {
  featured: Property[];
  browse: Property[];
  limit?: number;
};

type ExploreFeedOptions = {
  limit?: number;
  marketCountry?: string | null;
};

const EXPLORE_SUPPORTED_MARKETS = new Set(["NG", "GB", "CA", "US"]);
const COUNTRY_NAME_TO_MARKET: Record<string, "NG" | "GB" | "CA" | "US"> = {
  nigeria: "NG",
  "united kingdom": "GB",
  uk: "GB",
  gb: "GB",
  canada: "CA",
  "united states": "US",
  usa: "US",
  us: "US",
};

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(40, Math.trunc(limit as number)));
}

function normalizeExploreMarketCode(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "UK") return "GB";
  if (!EXPLORE_SUPPORTED_MARKETS.has(normalized)) return null;
  return normalized;
}

function resolveExploreListingMarket(property: Property): string | null {
  const byCode = normalizeExploreMarketCode(property.country_code);
  if (byCode) return byCode;
  if (typeof property.country === "string") {
    return COUNTRY_NAME_TO_MARKET[property.country.trim().toLowerCase()] ?? null;
  }
  return null;
}

export function buildExploreFeed({ featured, browse, limit }: ExploreFeedInput): Property[] {
  const resolvedLimit = clampLimit(limit);
  const byId = new Map<string, Property>();

  [...featured, ...browse].forEach((property) => {
    if (!property?.id || byId.has(property.id)) return;
    byId.set(property.id, property);
  });

  return Array.from(byId.values()).slice(0, resolvedLimit);
}

export function filterExploreFeedByMarket(
  listings: ReadonlyArray<Property>,
  marketCountry: string | null | undefined
): Property[] {
  const normalizedMarket = normalizeExploreMarketCode(marketCountry);
  if (!normalizedMarket) return [...listings];

  const sameMarket = listings.filter((listing) => resolveExploreListingMarket(listing) === normalizedMarket);
  if (sameMarket.length > 0) return sameMarket;
  return [...listings];
}

export async function getExploreFeed(options: ExploreFeedOptions = {}): Promise<Property[]> {
  const limit = clampLimit(options.limit);
  const fallback = filterExploreFeedByMarket(
    buildExploreFeed({
      featured: mockProperties,
      browse: mockProperties,
      limit,
    }),
    options.marketCountry ?? null
  );

  if (!hasServerSupabaseEnv()) {
    return DEV_MOCKS ? fallback : [];
  }

  const baseFilters = parseFiltersFromSearchParams(new URLSearchParams());
  const [featuredResult, browseResult] = await Promise.all([
    searchProperties(baseFilters, { page: 1, pageSize: Math.max(8, limit), featuredOnly: true }),
    searchProperties(baseFilters, { page: 1, pageSize: Math.max(20, limit * 2) }),
  ]);

  if (featuredResult.error) {
    console.warn("[explore] featured feed request failed", featuredResult.error.message);
  }
  if (browseResult.error) {
    console.warn("[explore] browse feed request failed", browseResult.error.message);
  }

  const featured = featuredResult.error ? [] : ((featuredResult.data as Property[]) ?? []);
  const browse = browseResult.error ? [] : ((browseResult.data as Property[]) ?? []);
  const feed = filterExploreFeedByMarket(
    buildExploreFeed({ featured, browse, limit }),
    options.marketCountry ?? null
  );
  if (feed.length) return feed;

  return DEV_MOCKS ? fallback : [];
}
