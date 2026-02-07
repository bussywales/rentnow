import type { Property } from "@/lib/types";

export function findCuratedListing(listings: Property[], propertyId: string) {
  const match = listings.find((listing) => listing.id === propertyId);
  if (!match) return null;
  if (match.status && match.status !== "live") return null;
  return match;
}
