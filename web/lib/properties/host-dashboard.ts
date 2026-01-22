import type { Property } from "@/lib/types";
import {
  computeListingReadiness,
  type ReadinessResult,
  type ReadinessIssueCode,
} from "./listing-readiness";

export type DashboardListing = Property & {
  readiness: ReadinessResult;
};

export type FilterType = "all" | "needs_attention" | "ready" | "drafts";

const tierRank: Record<ReadinessResult["tier"], number> = {
  Excellent: 2,
  Good: 1,
  "Needs work": 0,
};

export function sortListings(listings: DashboardListing[]): DashboardListing[] {
  return [...listings].sort((a, b) => {
    if (a.readiness.score !== b.readiness.score) {
      return a.readiness.score - b.readiness.score;
    }
    if (tierRank[a.readiness.tier] !== tierRank[b.readiness.tier]) {
      return tierRank[a.readiness.tier] - tierRank[b.readiness.tier];
    }
    const aUpdated = a.updated_at || a.created_at || "";
    const bUpdated = b.updated_at || b.created_at || "";
    if (aUpdated !== bUpdated) {
      return (bUpdated || "").localeCompare(aUpdated || "");
    }
    return (a.id || "").localeCompare(b.id || "");
  });
}

export function filterListings(listings: DashboardListing[], filter: FilterType): DashboardListing[] {
  switch (filter) {
    case "needs_attention":
      return listings.filter(
        (item) =>
          item.readiness.tier !== "Excellent" ||
          item.readiness.score < 90 ||
          item.readiness.issues.length > 0
      );
    case "ready":
      return listings.filter(
        (item) =>
          item.readiness.tier === "Excellent" &&
          item.readiness.score >= 90 &&
          item.readiness.issues.length === 0
      );
    case "drafts":
      return listings.filter((item) => (item.status ?? "draft") === "draft");
    default:
      return listings;
  }
}

export function searchListings(listings: DashboardListing[], query: string): DashboardListing[] {
  const q = query.trim().toLowerCase();
  if (!q) return listings;
  return listings.filter((item) => {
    const haystack = [
      item.title,
      item.location_label,
      item.city,
      item.admin_area_1,
      item.admin_area_2,
      item.postal_code,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function computeDashboardListings(properties: Property[]): DashboardListing[] {
  return properties.map((property) => ({
    ...property,
    readiness: computeListingReadiness(property),
  }));
}

export function summarizeListings(listings: DashboardListing[]) {
  const total = listings.length;
  const needsAttention = filterListings(listings, "needs_attention").length;
  const ready = filterListings(listings, "ready").length;
  return { total, needsAttention, ready };
}

export function resumeSetupHref(propertyId: string, topIssue?: ReadinessIssueCode) {
  if (!topIssue) return `/dashboard/properties/${propertyId}`;
  if (topIssue === "LOCATION_WEAK" || topIssue === "LOCATION_MEDIUM") {
    return `/dashboard/properties/${propertyId}?focus=location`;
  }
  return `/dashboard/properties/${propertyId}?step=photos`;
}

export function getLastUpdatedDate(listing: DashboardListing) {
  return listing.updated_at || listing.created_at || null;
}
