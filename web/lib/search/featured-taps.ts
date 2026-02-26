export const FEATURED_TAPS_STORAGE_KEY = "ph:search:featured-taps:v1";
export const FEATURED_TAPS_STORAGE_EVENT = "ph:search:featured-taps:v1:changed";

const DEFAULT_FEATURED_TAPS_LIMIT = 8;

export type FeaturedTapRecord = {
  id: string;
  marketCountry: string;
  kind: "shortlet" | "property";
  href: string;
  label: string;
  query: string;
  source: "featured";
  tappedAt: string;
};

export type QuickSearchRecentItem = {
  id: string;
  label: string;
  source: "search" | "featured";
  query: string;
  href: string | null;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeCountryCode(value: unknown): string {
  const normalized = normalizeString(value, 8).toUpperCase();
  return /^[A-Z]{2,3}$/.test(normalized) ? normalized : "GLOBAL";
}

function normalizeKind(value: unknown): "shortlet" | "property" | null {
  if (value === "shortlet" || value === "property") return value;
  return null;
}

function normalizeHref(value: unknown): string {
  const href = normalizeString(value, 500);
  return href.startsWith("/") ? href : "";
}

function normalizeDateIso(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  return new Date().toISOString();
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_FEATURED_TAPS_LIMIT;
  return Math.min(30, Math.floor(limit));
}

function buildTapKey(record: Pick<FeaturedTapRecord, "id" | "marketCountry">): string {
  return `${record.marketCountry}:${record.id}`;
}

function parseQueryFromHref(href: string): string {
  const paramsSource = href.includes("?") ? href.split("?")[1] : "";
  if (!paramsSource) return "";
  const params = new URLSearchParams(paramsSource);
  const city = normalizeString(params.get("city"), 100);
  if (city) return city;
  const where = normalizeString(params.get("where"), 100);
  if (where) return where;
  const q = normalizeString(params.get("q"), 100);
  if (q) return q;
  return "";
}

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FEATURED_TAPS_STORAGE_EVENT));
}

function parseFeaturedTaps(raw: string | null | undefined): FeaturedTapRecord[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const candidates = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { items?: unknown[] }).items)
    ? (parsed as { items: unknown[] }).items
    : [];

  const seen = new Set<string>();
  const normalized: FeaturedTapRecord[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Partial<FeaturedTapRecord>;
    const id = normalizeString(entry.id, 160);
    const marketCountry = normalizeCountryCode(entry.marketCountry);
    const kind = normalizeKind(entry.kind);
    const href = normalizeHref(entry.href);
    const label = normalizeString(entry.label, 180);
    if (!id || !kind || !href || !label) continue;

    const key = `${marketCountry}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({
      id,
      marketCountry,
      kind,
      href,
      label,
      query: normalizeString(entry.query, 100) || parseQueryFromHref(href),
      source: "featured",
      tappedAt: normalizeDateIso(entry.tappedAt),
    });
  }

  normalized.sort((a, b) => b.tappedAt.localeCompare(a.tappedAt));
  return normalized;
}

function readFeaturedTaps(): FeaturedTapRecord[] {
  if (!isBrowser()) return [];
  try {
    return parseFeaturedTaps(window.localStorage.getItem(FEATURED_TAPS_STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeFeaturedTaps(items: FeaturedTapRecord[]): FeaturedTapRecord[] {
  if (!isBrowser()) return [];
  const normalized = parseFeaturedTaps(JSON.stringify(items));
  try {
    window.localStorage.setItem(
      FEATURED_TAPS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        items: normalized,
      })
    );
  } catch {
    // Ignore storage failures.
  }
  return normalized;
}

export function getRecentFeaturedTaps(input?: {
  marketCountry?: string | null;
  limit?: number;
}): FeaturedTapRecord[] {
  const marketCountry = input?.marketCountry ? normalizeCountryCode(input.marketCountry) : null;
  const limit = normalizeLimit(input?.limit ?? DEFAULT_FEATURED_TAPS_LIMIT);
  const records = readFeaturedTaps();
  return records
    .filter((record) => (!marketCountry ? true : record.marketCountry === marketCountry))
    .slice(0, limit);
}

export function pushRecentFeaturedTap(
  input: {
    id: string;
    marketCountry?: string | null;
    kind: "shortlet" | "property";
    href: string;
    label: string;
    query?: string | null;
  },
  limit = DEFAULT_FEATURED_TAPS_LIMIT
): FeaturedTapRecord[] {
  if (!isBrowser()) return [];

  const id = normalizeString(input.id, 160);
  const marketCountry = normalizeCountryCode(input.marketCountry);
  const kind = normalizeKind(input.kind);
  const href = normalizeHref(input.href);
  const label = normalizeString(input.label, 180);
  const query = normalizeString(input.query, 100) || parseQueryFromHref(href);
  if (!id || !kind || !href || !label) {
    return readFeaturedTaps().slice(0, normalizeLimit(limit));
  }

  const next: FeaturedTapRecord = {
    id,
    marketCountry,
    kind,
    href,
    label,
    query,
    source: "featured",
    tappedAt: new Date().toISOString(),
  };

  const withoutCurrent = readFeaturedTaps().filter((item) => buildTapKey(item) !== buildTapKey(next));
  const stored = writeFeaturedTaps([next, ...withoutCurrent].slice(0, normalizeLimit(limit)));
  emitChange();
  return stored;
}

export function clearRecentFeaturedTaps(input?: { marketCountry?: string | null }): FeaturedTapRecord[] {
  if (!isBrowser()) return [];

  if (!input?.marketCountry) {
    try {
      window.localStorage.removeItem(FEATURED_TAPS_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
    emitChange();
    return [];
  }

  const marketCountry = normalizeCountryCode(input.marketCountry);
  const remaining = readFeaturedTaps().filter((item) => item.marketCountry !== marketCountry);
  const stored = writeFeaturedTaps(remaining);
  emitChange();
  return stored;
}

export function mergeRecentSearchesWithFeaturedTaps(input: {
  searchTerms: string[];
  featuredTaps: FeaturedTapRecord[];
  limit?: number;
}): QuickSearchRecentItem[] {
  const limit = normalizeLimit(input.limit ?? DEFAULT_FEATURED_TAPS_LIMIT);
  const merged: QuickSearchRecentItem[] = [];
  const seen = new Set<string>();

  for (const term of input.searchTerms) {
    const label = normalizeString(term, 100);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      id: `search:${key}`,
      label,
      source: "search",
      query: label,
      href: null,
    });
    if (merged.length >= limit) return merged;
  }

  for (const tap of input.featuredTaps) {
    const label = normalizeString(tap.label, 180);
    if (!label) continue;
    const dedupeToken = (tap.query || label).toLowerCase();
    if (seen.has(dedupeToken)) continue;
    seen.add(dedupeToken);
    merged.push({
      id: `featured:${tap.marketCountry}:${tap.id}`,
      label,
      source: "featured",
      query: tap.query,
      href: tap.href,
    });
    if (merged.length >= limit) return merged;
  }

  return merged;
}
