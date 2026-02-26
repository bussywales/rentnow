import { filtersToSearchParams } from "@/lib/search-filters";
import type { ParsedSearchFilters } from "@/lib/types";

export const LAST_SEARCH_STORAGE_KEY = "ph:last-search";

export type LastSearchState = {
  query: string;
  filters: ParsedSearchFilters;
  updatedAt: string;
};

export function readLastSearchState(): LastSearchState | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_SEARCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastSearchState>;
    if (!parsed?.filters || typeof parsed.filters !== "object") return null;
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      filters: parsed.filters as ParsedSearchFilters,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function getLastSearchHref(): string | null {
  const state = readLastSearchState();
  if (!state) return null;
  return buildSearchHref(state.filters);
}

export function buildSearchHref(filters: ParsedSearchFilters) {
  const params = filtersToSearchParams(filters);
  if (!params.get("intent") && filters.listingIntent === "all") {
    params.set("intent", "all");
  }
  const query = params.toString();
  return query ? `/properties?${query}` : "/properties";
}
