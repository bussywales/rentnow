import type { UserRole } from "@/lib/types";
import { isListingPubliclyVisible, type ListingVisibilityInput } from "@/lib/properties/expiry";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";

export type FeaturedListingInput = {
  is_featured?: boolean | null;
  featured_until?: string | null;
};

export function isFeaturedListingActive(
  listing: FeaturedListingInput,
  now: Date = new Date()
): boolean {
  if (!listing.is_featured) return false;
  if (!listing.featured_until) return true;
  const untilMs = Date.parse(listing.featured_until);
  if (!Number.isFinite(untilMs)) return true;
  return untilMs > now.getTime();
}

export function isPubliclyEligibleFeaturedListing(
  listing: FeaturedListingInput &
    ListingVisibilityInput & {
      is_demo?: boolean | null;
    },
  input: {
    viewerRole?: UserRole | null;
    now?: Date;
    nodeEnv?: string;
  } = {}
): boolean {
  const now = input.now ?? new Date();
  if (!isFeaturedListingActive(listing, now)) return false;
  if (!isListingPubliclyVisible(listing, now)) return false;
  const includeDemo = includeDemoListingsForViewer({
    viewerRole: input.viewerRole,
    nodeEnv: input.nodeEnv,
  });
  if (!includeDemo && listing.is_demo) return false;
  return true;
}
