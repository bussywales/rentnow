import type { DashboardListing } from "@/lib/properties/host-dashboard";
import { normalizePropertyStatus } from "@/lib/properties/status";
import { isListingExpired } from "@/lib/properties/expiry";

export type HostPropertiesStatusFilter = "all" | "live" | "pending" | "paused" | "draft";
export type HostPropertiesSort = "newest" | "updated";

export type HostPropertiesManagerQuery = {
  status: HostPropertiesStatusFilter;
  search: string;
  sort: HostPropertiesSort;
};

export function resolveManagerStatus(listing: DashboardListing): Exclude<HostPropertiesStatusFilter, "all"> {
  const normalized = normalizePropertyStatus(listing.status ?? null);

  if (normalized === "live" && isListingExpired(listing)) {
    return "paused";
  }

  if (normalized === "pending") return "pending";
  if (
    normalized === "paused" ||
    normalized === "paused_owner" ||
    normalized === "paused_occupied" ||
    normalized === "expired" ||
    normalized === "rejected"
  ) {
    return "paused";
  }

  if (normalized === "draft" || normalized === "changes_requested") {
    return "draft";
  }

  return "live";
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function toSafeDate(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareById(a: DashboardListing, b: DashboardListing) {
  return String(a.id || "").localeCompare(String(b.id || ""));
}

export function filterAndSortHostProperties(
  listings: DashboardListing[],
  query: HostPropertiesManagerQuery
): DashboardListing[] {
  const search = normalizeSearch(query.search);

  const filtered = listings.filter((listing) => {
    if (query.status !== "all" && resolveManagerStatus(listing) !== query.status) {
      return false;
    }

    if (!search) return true;

    const haystack = [
      listing.title,
      listing.location_label,
      listing.city,
      listing.admin_area_1,
      listing.admin_area_2,
      listing.postal_code,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });

  return [...filtered].sort((a, b) => {
    if (query.sort === "updated") {
      const delta = toSafeDate(b.updated_at || b.created_at) - toSafeDate(a.updated_at || a.created_at);
      if (delta !== 0) return delta;
      return compareById(a, b);
    }

    const delta = toSafeDate(b.created_at) - toSafeDate(a.created_at);
    if (delta !== 0) return delta;
    return compareById(a, b);
  });
}

export function countByManagerStatus(listings: DashboardListing[]) {
  return listings.reduce(
    (counts, listing) => {
      const status = resolveManagerStatus(listing);
      counts[status] += 1;
      counts.all += 1;
      return counts;
    },
    {
      all: 0,
      live: 0,
      pending: 0,
      paused: 0,
      draft: 0,
    } as Record<HostPropertiesStatusFilter, number>
  );
}
