export type FeaturedInventoryItem = {
  id: string;
  title: string | null;
  city: string | null;
  status: string | null;
  featured_rank: number | null;
  featured_until: string | null;
  updated_at: string | null;
  featured_impressions_7d?: number;
  featured_clicks_7d?: number;
  featured_leads_7d?: number;
  featured_ctr_7d?: number | null;
};

export type FeaturedInventorySummary = {
  featuredActive: FeaturedInventoryItem[];
  featuredExpiringSoon: FeaturedInventoryItem[];
  featuredExpired: FeaturedInventoryItem[];
  countsByCity: Record<string, number>;
};

function normalizeRank(rank: number | null | undefined) {
  return typeof rank === "number" && Number.isFinite(rank) ? rank : Number.POSITIVE_INFINITY;
}

function normalizeTime(value: string | null | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function sortFeatured(a: FeaturedInventoryItem, b: FeaturedInventoryItem) {
  const rankDiff = normalizeRank(a.featured_rank) - normalizeRank(b.featured_rank);
  if (rankDiff !== 0) return rankDiff;
  const untilDiff =
    normalizeTime(a.featured_until, Number.POSITIVE_INFINITY) -
    normalizeTime(b.featured_until, Number.POSITIVE_INFINITY);
  if (untilDiff !== 0) return untilDiff;
  return normalizeTime(b.updated_at, 0) - normalizeTime(a.updated_at, 0);
}

export function buildFeaturedInventorySummary(
  items: FeaturedInventoryItem[],
  now: Date = new Date(),
  expiringWindowDays = 7
): FeaturedInventorySummary {
  const nowMs = now.getTime();
  const expiringCutoff = nowMs + expiringWindowDays * 24 * 60 * 60 * 1000;

  const featuredActive: FeaturedInventoryItem[] = [];
  const featuredExpiringSoon: FeaturedInventoryItem[] = [];
  const featuredExpired: FeaturedInventoryItem[] = [];

  for (const item of items) {
    const untilMs = normalizeTime(item.featured_until, Number.POSITIVE_INFINITY);
    if (item.featured_until && untilMs <= nowMs) {
      featuredExpired.push(item);
      continue;
    }
    featuredActive.push(item);
    if (item.featured_until && untilMs > nowMs && untilMs <= expiringCutoff) {
      featuredExpiringSoon.push(item);
    }
  }

  featuredActive.sort(sortFeatured);
  featuredExpiringSoon.sort(sortFeatured);
  featuredExpired.sort((a, b) =>
    normalizeTime(b.featured_until, 0) - normalizeTime(a.featured_until, 0)
  );

  const countsByCity: Record<string, number> = {};
  for (const item of featuredActive) {
    const city = item.city?.trim();
    if (!city) continue;
    countsByCity[city] = (countsByCity[city] ?? 0) + 1;
  }

  return { featuredActive, featuredExpiringSoon, featuredExpired, countsByCity };
}

export const FEATURED_EXPIRING_WINDOW_DAYS = 7;
export const FEATURED_CITY_WARNING_THRESHOLD = 12;
export const DEFAULT_FEATURED_DURATION_DAYS = 14;
export const FEATURED_PRESET_DAYS = [7, 14, 30] as const;
