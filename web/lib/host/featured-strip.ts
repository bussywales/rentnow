import type { DashboardListing } from "@/lib/properties/host-dashboard";

export const HOST_FEATURED_STRIP_LIMIT = 6;

function parseTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function resolveActivityTimestamp(listing: DashboardListing): number {
  return Math.max(
    parseTimestamp(listing.updated_at),
    parseTimestamp(listing.created_at),
    0
  );
}

export function isHostListingFeaturedActive(
  listing: DashboardListing,
  nowMs = Date.now()
): boolean {
  if (!listing.is_featured) return false;
  if (!listing.featured_until) return true;
  const featuredUntilMs = parseTimestamp(listing.featured_until);
  if (!Number.isFinite(featuredUntilMs)) return false;
  return featuredUntilMs > nowMs;
}

export function selectHostFeaturedStripListings(
  listings: DashboardListing[],
  nowMs = Date.now()
): DashboardListing[] {
  if (!Array.isArray(listings) || listings.length === 0) return [];

  const withIndex = listings.map((listing, index) => ({ listing, index }));
  const featured = withIndex.filter(({ listing }) =>
    isHostListingFeaturedActive(listing, nowMs)
  );

  const featuredSorted = featured.sort((a, b) => {
    const aRank = Number.isFinite(a.listing.featured_rank)
      ? Number(a.listing.featured_rank)
      : Number.POSITIVE_INFINITY;
    const bRank = Number.isFinite(b.listing.featured_rank)
      ? Number(b.listing.featured_rank)
      : Number.POSITIVE_INFINITY;
    if (aRank !== bRank) return aRank - bRank;

    const aActivity = resolveActivityTimestamp(a.listing);
    const bActivity = resolveActivityTimestamp(b.listing);
    if (aActivity !== bActivity) return bActivity - aActivity;

    return a.index - b.index;
  });

  const fallback = withIndex
    .filter(({ listing }) => !isHostListingFeaturedActive(listing, nowMs))
    .sort((a, b) => {
      const aActivity = resolveActivityTimestamp(a.listing);
      const bActivity = resolveActivityTimestamp(b.listing);
      if (aActivity !== bActivity) return bActivity - aActivity;
      return a.index - b.index;
    });

  return [...featuredSorted, ...fallback]
    .slice(0, HOST_FEATURED_STRIP_LIMIT)
    .map(({ listing }) => listing);
}
