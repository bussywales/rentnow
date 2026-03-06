import { DEV_MOCKS } from "@/lib/env";
import { resolveExplorePropertyImageRecords } from "@/lib/explore/gallery-images";
import { partitionExploreListingsByImageQuality } from "@/lib/explore/listing-quality";
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

type ExplorePropertyRow = Property & {
  property_images?: Property["images"] | null;
};

type ExploreFeedOptions = {
  limit?: number;
  marketCountry?: string | null;
};

export type ExploreFeedSectionKey = "market_picks" | "more_to_explore";

export type ExploreSectionedFeed = {
  marketPicks: Property[];
  moreToExplore: Property[];
  meta: {
    marketCode: string | null;
    total: number;
    targetMinimum: number;
    appliedFallback: boolean;
    limitedResults: boolean;
  };
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
const EXPLORE_MINIMUM_TARGET = 12;

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

function normalizeExplorePropertyRow(row: ExplorePropertyRow): Property {
  const images = resolveExplorePropertyImageRecords(row);
  if (images.length === 0 && Array.isArray(row.images)) return row;
  return {
    ...row,
    images,
  };
}

function dedupeExploreListingsById(listings: ReadonlyArray<Property>): Property[] {
  const byId = new Map<string, Property>();
  listings.forEach((listing) => {
    if (!listing?.id || byId.has(listing.id)) return;
    byId.set(listing.id, listing);
  });
  return Array.from(byId.values());
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

export function applyExploreImageQualityFilter(
  listings: ReadonlyArray<Property>,
  limit?: number
): Property[] {
  const resolvedLimit = clampLimit(limit);
  const { healthy, limited } = partitionExploreListingsByImageQuality(listings);
  if (healthy.length >= resolvedLimit) {
    return healthy.slice(0, resolvedLimit);
  }
  return [...healthy, ...limited].slice(0, resolvedLimit);
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

export function buildExploreSectionedFeed(
  listings: ReadonlyArray<Property>,
  options: ExploreFeedOptions = {}
): ExploreSectionedFeed {
  const limit = clampLimit(options.limit);
  const targetMinimum = Math.min(limit, EXPLORE_MINIMUM_TARGET);
  const marketCode = normalizeExploreMarketCode(options.marketCountry);
  const deduped = dedupeExploreListingsById(listings).slice(0, limit);

  if (!marketCode) {
    const total = deduped.length;
    return {
      marketPicks: deduped,
      moreToExplore: [],
      meta: {
        marketCode: null,
        total,
        targetMinimum,
        appliedFallback: false,
        limitedResults: total < targetMinimum,
      },
    };
  }

  const marketPicks = deduped.filter((listing) => resolveExploreListingMarket(listing) === marketCode);
  const fallbackPool = deduped.filter((listing) => resolveExploreListingMarket(listing) !== marketCode);
  const fallbackSlots = Math.max(0, targetMinimum - marketPicks.length);
  const moreToExplore = fallbackPool.slice(0, fallbackSlots);
  const total = Math.min(limit, marketPicks.length + moreToExplore.length);

  return {
    marketPicks: marketPicks.slice(0, limit),
    moreToExplore,
    meta: {
      marketCode,
      total,
      targetMinimum,
      appliedFallback: moreToExplore.length > 0,
      limitedResults: total < targetMinimum,
    },
  };
}

export function flattenExploreSectionedFeed(feed: ExploreSectionedFeed): Property[] {
  return [...feed.marketPicks, ...feed.moreToExplore];
}

export async function getExploreFeed(options: ExploreFeedOptions = {}): Promise<Property[]> {
  const feed = await getSectionedExploreFeed(options);
  return flattenExploreSectionedFeed(feed);
}

export async function getSectionedExploreFeed(options: ExploreFeedOptions = {}): Promise<ExploreSectionedFeed> {
  const limit = clampLimit(options.limit);
  const feedSourceLimit = clampLimit(Math.max(limit * 2, EXPLORE_MINIMUM_TARGET * 2));
  const fallbackCandidate = buildExploreFeed({
    featured: mockProperties,
    browse: mockProperties,
    limit: feedSourceLimit,
  });
  const fallbackQualityFeed = applyExploreImageQualityFilter(fallbackCandidate, feedSourceLimit);
  const fallbackFeed = fallbackQualityFeed.length ? fallbackQualityFeed : fallbackCandidate.slice(0, feedSourceLimit);
  const fallbackSectioned = buildExploreSectionedFeed(fallbackFeed, options);

  if (!hasServerSupabaseEnv()) {
    return DEV_MOCKS
      ? {
          ...fallbackSectioned,
          marketPicks: fallbackSectioned.marketPicks.slice(0, limit),
          moreToExplore: fallbackSectioned.moreToExplore.slice(
            0,
            Math.max(0, limit - fallbackSectioned.marketPicks.length)
          ),
        }
      : buildExploreSectionedFeed([], options);
  }

  const baseFilters = parseFiltersFromSearchParams(new URLSearchParams());
  const [featuredResult, browseResult] = await Promise.all([
    searchProperties(baseFilters, {
      page: 1,
      pageSize: Math.max(8, feedSourceLimit),
      featuredOnly: true,
      includeVideoSignal: true,
    }),
    searchProperties(baseFilters, {
      page: 1,
      pageSize: Math.max(20, feedSourceLimit),
      includeVideoSignal: true,
    }),
  ]);

  if (featuredResult.error) {
    console.warn("[explore] featured feed request failed", featuredResult.error.message);
  }
  if (browseResult.error) {
    console.warn("[explore] browse feed request failed", browseResult.error.message);
  }

  const featured = featuredResult.error
    ? []
    : (((featuredResult.data as ExplorePropertyRow[]) ?? []).map(normalizeExplorePropertyRow) as Property[]);
  const browse = browseResult.error
    ? []
    : (((browseResult.data as ExplorePropertyRow[]) ?? []).map(normalizeExplorePropertyRow) as Property[]);
  const feedCandidate = buildExploreFeed({ featured, browse, limit: feedSourceLimit });
  const qualityFeed = applyExploreImageQualityFilter(feedCandidate, feedSourceLimit);
  const sectionedFeed = buildExploreSectionedFeed(qualityFeed.length ? qualityFeed : feedCandidate, options);
  const boundedFeed: ExploreSectionedFeed = {
    ...sectionedFeed,
    marketPicks: sectionedFeed.marketPicks.slice(0, limit),
    moreToExplore: sectionedFeed.moreToExplore.slice(0, Math.max(0, limit - sectionedFeed.marketPicks.length)),
  };

  if (flattenExploreSectionedFeed(boundedFeed).length) {
    return boundedFeed;
  }

  return DEV_MOCKS
    ? {
        ...fallbackSectioned,
        marketPicks: fallbackSectioned.marketPicks.slice(0, limit),
        moreToExplore: fallbackSectioned.moreToExplore.slice(0, Math.max(0, limit - fallbackSectioned.marketPicks.length)),
      }
    : buildExploreSectionedFeed([], options);
}
