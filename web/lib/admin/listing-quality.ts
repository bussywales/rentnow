import {
  computeListingCompleteness,
  resolveListingCompletenessStatus,
  type ListingCompletenessResult,
  type ListingCompletenessStatus,
  type ListingQualityInput,
} from "@/lib/properties/listing-quality";

export type AdminListingQualityStatus = ListingCompletenessStatus;

export type AdminListingQualitySummary = {
  completeness: ListingCompletenessResult;
  status: AdminListingQualityStatus;
};

export function resolveAdminListingQualityStatus(score: number): AdminListingQualityStatus {
  return resolveListingCompletenessStatus(score);
}

export function computeAdminListingQuality(listing: ListingQualityInput): AdminListingQualitySummary {
  const completeness = computeListingCompleteness(listing);
  return {
    completeness,
    status: resolveAdminListingQualityStatus(completeness.score),
  };
}
