import {
  computeListingCompleteness,
  type ListingCompletenessResult,
  type ListingQualityInput,
} from "@/lib/properties/listing-quality";

export type AdminListingQualityStatus = "Strong" | "Fair" | "Needs work";

export type AdminListingQualitySummary = {
  completeness: ListingCompletenessResult;
  status: AdminListingQualityStatus;
};

export function resolveAdminListingQualityStatus(score: number): AdminListingQualityStatus {
  if (score >= 85) return "Strong";
  if (score >= 60) return "Fair";
  return "Needs work";
}

export function computeAdminListingQuality(listing: ListingQualityInput): AdminListingQualitySummary {
  const completeness = computeListingCompleteness(listing);
  return {
    completeness,
    status: resolveAdminListingQualityStatus(completeness.score),
  };
}
