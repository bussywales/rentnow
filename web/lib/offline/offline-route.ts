export type OfflineRouteKind = "home" | "search" | "collections" | "generic";

export type OfflineSavedSearchLink = {
  label: string;
  href: string;
};

export type OfflineSectionVisibility = {
  showSaved: boolean;
  showViewed: boolean;
  showRecommended: boolean;
  showSavedSearches: boolean;
  showCollectionsNote: boolean;
  showEmptyState: boolean;
};

const OFFLINE_FALLBACK_ROUTE = "/";
const MAX_FROM_LENGTH = 500;
const MOBILE_QUICKSEARCH_RECENTS_KEY = "mobile_quicksearch_v1";

export function getOfflineRecentSearchesStorageKey() {
  return MOBILE_QUICKSEARCH_RECENTS_KEY;
}

export function normalizeOfflineFromPath(input: string | null | undefined): string {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return OFFLINE_FALLBACK_ROUTE;

  let value = trimmed;
  if (!value.startsWith("/")) {
    try {
      const parsed = new URL(value, "https://offline.local");
      value = `${parsed.pathname}${parsed.search}`;
    } catch {
      return OFFLINE_FALLBACK_ROUTE;
    }
  }

  const hashIndex = value.indexOf("#");
  if (hashIndex >= 0) {
    value = value.slice(0, hashIndex);
  }

  if (!value.startsWith("/")) return OFFLINE_FALLBACK_ROUTE;
  return value.slice(0, MAX_FROM_LENGTH);
}

export function resolveOfflineRouteKind(fromPath: string): OfflineRouteKind {
  const normalized = normalizeOfflineFromPath(fromPath).toLowerCase();
  if (normalized.startsWith("/collections")) return "collections";
  if (normalized.startsWith("/shortlets") || normalized.startsWith("/properties")) {
    return "search";
  }
  if (
    normalized === "/" ||
    normalized.startsWith("/?") ||
    normalized.startsWith("/home")
  ) {
    return "home";
  }
  return "generic";
}

function isAllowedSearchHref(href: string): boolean {
  return href.startsWith("/shortlets") || href.startsWith("/properties");
}

function buildRecentSearchHref(input: {
  routeKind: OfflineRouteKind;
  fromPath: string;
  term: string;
}): string {
  const encoded = encodeURIComponent(input.term);
  if (input.routeKind === "search" && input.fromPath.startsWith("/shortlets")) {
    return `/shortlets?city=${encoded}`;
  }
  return `/properties?city=${encoded}`;
}

export function buildOfflineSavedSearchLinks(input: {
  fromPath: string;
  recentSearchTerms: ReadonlyArray<string>;
  lastSearchHref: string | null;
  lastShortletBrowseHref: string | null;
  lastPropertyBrowseHref: string | null;
  limit?: number;
}): OfflineSavedSearchLink[] {
  const fromPath = normalizeOfflineFromPath(input.fromPath);
  const routeKind = resolveOfflineRouteKind(fromPath);
  const limit = Math.max(1, Math.min(8, Math.floor(input.limit ?? 4)));
  const candidates: OfflineSavedSearchLink[] = [];

  if (routeKind === "search" && fromPath.includes("?") && isAllowedSearchHref(fromPath)) {
    candidates.push({ label: "Retry this search", href: fromPath });
  }
  if (input.lastShortletBrowseHref && isAllowedSearchHref(input.lastShortletBrowseHref)) {
    candidates.push({ label: "Resume shortlets search", href: input.lastShortletBrowseHref });
  }
  if (input.lastPropertyBrowseHref && isAllowedSearchHref(input.lastPropertyBrowseHref)) {
    candidates.push({ label: "Resume property search", href: input.lastPropertyBrowseHref });
  }
  if (input.lastSearchHref && isAllowedSearchHref(input.lastSearchHref)) {
    candidates.push({ label: "Use last search", href: input.lastSearchHref });
  }

  for (const rawTerm of input.recentSearchTerms) {
    const term = rawTerm.trim();
    if (!term) continue;
    candidates.push({
      label: `Search "${term}"`,
      href: buildRecentSearchHref({ routeKind, fromPath, term }),
    });
  }

  const seen = new Set<string>();
  const deduped: OfflineSavedSearchLink[] = [];
  for (const candidate of candidates) {
    if (!isAllowedSearchHref(candidate.href)) continue;
    if (seen.has(candidate.href)) continue;
    seen.add(candidate.href);
    deduped.push(candidate);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

export function resolveOfflineSectionVisibility(input: {
  routeKind: OfflineRouteKind;
  savedCount: number;
  viewedCount: number;
  recommendedCount: number;
  savedSearchCount: number;
}): OfflineSectionVisibility {
  const base = {
    showSaved: false,
    showViewed: false,
    showRecommended: false,
    showSavedSearches: false,
    showCollectionsNote: false,
  };

  if (input.routeKind === "home" || input.routeKind === "generic") {
    base.showSaved = input.savedCount > 0;
    base.showViewed = input.viewedCount > 0;
    base.showRecommended = input.recommendedCount > 0;
  } else if (input.routeKind === "search") {
    base.showSaved = input.savedCount > 0;
    base.showViewed = input.viewedCount > 0;
    base.showSavedSearches = input.savedSearchCount > 0;
  } else if (input.routeKind === "collections") {
    base.showSaved = input.savedCount > 0;
    base.showViewed = input.viewedCount > 0;
    base.showCollectionsNote = true;
  }

  const contentCount =
    (base.showSaved ? 1 : 0) +
    (base.showViewed ? 1 : 0) +
    (base.showRecommended ? 1 : 0) +
    (base.showSavedSearches ? 1 : 0);

  return {
    ...base,
    showEmptyState: contentCount === 0,
  };
}
