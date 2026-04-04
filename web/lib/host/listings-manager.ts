import { normalizeListingIntent } from "@/lib/listing-intents";
import { resolveManagerStatus } from "@/lib/host/properties-manager";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

export type HostListingsIntentFilter = "all" | "rent" | "sale" | "shortlet" | "off_plan";

export type HostListingsPortfolioStats = {
  total: number;
  live: number;
  pending: number;
  draft: number;
  changes_requested: number;
  rejected: number;
  paused: number;
};

export function summarizeHostListingsPortfolio(listings: DashboardListing[]): HostListingsPortfolioStats {
  return listings.reduce<HostListingsPortfolioStats>(
    (summary, listing) => {
      summary.total += 1;
      const status = resolveManagerStatus(listing);
      summary[status] += 1;
      return summary;
    },
    {
      total: 0,
      live: 0,
      pending: 0,
      draft: 0,
      changes_requested: 0,
      rejected: 0,
      paused: 0,
    }
  );
}

function resolveListingIntent(listing: DashboardListing) {
  const intent = normalizeListingIntent(listing.listing_intent ?? null);
  if (intent) return intent;
  const rentalType = String(listing.rental_type ?? "").toLowerCase();
  if (rentalType === "short-let" || rentalType === "shortlet") return "shortlet";
  return null;
}

export function filterHostListingsByIntent(
  listings: DashboardListing[],
  intentFilter: HostListingsIntentFilter
): DashboardListing[] {
  if (intentFilter === "all") return listings;
  return listings.filter((listing) => resolveListingIntent(listing) === intentFilter);
}
