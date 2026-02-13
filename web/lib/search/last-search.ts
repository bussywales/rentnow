import { filtersToSearchParams } from "@/lib/search-filters";
import type { ParsedSearchFilters } from "@/lib/types";

export const LAST_SEARCH_STORAGE_KEY = "ph:last-search";

export type LastSearchState = {
  query: string;
  filters: ParsedSearchFilters;
  updatedAt: string;
};

export function buildSearchHref(filters: ParsedSearchFilters) {
  const params = filtersToSearchParams(filters);
  if (!params.get("intent") && filters.listingIntent === "all") {
    params.set("intent", "all");
  }
  const query = params.toString();
  return query ? `/properties?${query}` : "/properties";
}
