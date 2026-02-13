import { filtersToSearchParams } from "@/lib/search-filters";
import type { ListingIntentFilter, ParsedSearchFilters } from "@/lib/types";

export type MarketHub = {
  key: string;
  label: string;
  query: ParsedSearchFilters;
};

const EMPTY_FILTERS: ParsedSearchFilters = {
  city: null,
  minPrice: null,
  maxPrice: null,
  currency: null,
  bedrooms: null,
  bedroomsMode: "exact",
  includeSimilarOptions: false,
  propertyType: null,
  rentalType: null,
  furnished: null,
  amenities: [],
};

function buildCityHub(key: string, city: string): MarketHub {
  return {
    key,
    label: city,
    query: {
      ...EMPTY_FILTERS,
      city,
    },
  };
}

const HUBS_BY_MARKET: Record<string, MarketHub[]> = {
  NG: [
    buildCityHub("lagos", "Lagos"),
    buildCityHub("abuja", "Abuja"),
    buildCityHub("port-harcourt", "Port Harcourt"),
    buildCityHub("ibadan", "Ibadan"),
    buildCityHub("enugu", "Enugu"),
  ],
  GB: [
    buildCityHub("london", "London"),
    buildCityHub("manchester", "Manchester"),
    buildCityHub("birmingham", "Birmingham"),
    buildCityHub("leeds", "Leeds"),
    buildCityHub("glasgow", "Glasgow"),
  ],
};

export function getMarketHubs(countryCode: string | null | undefined): MarketHub[] {
  if (!countryCode) return [];
  const normalized = countryCode.trim().toUpperCase();
  return HUBS_BY_MARKET[normalized] ?? [];
}

export function buildMarketHubHref(
  hub: MarketHub,
  options?: { intent?: ListingIntentFilter | null }
): string {
  const params = filtersToSearchParams(hub.query);
  if (options?.intent === "rent" || options?.intent === "buy") {
    params.set("intent", options.intent);
  } else if (options?.intent === "all") {
    params.set("intent", "all");
  }
  const query = params.toString();
  return query ? `/properties?${query}` : "/properties";
}
