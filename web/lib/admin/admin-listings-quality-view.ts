import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { resolveAdminListingQualityStatus } from "@/lib/admin/listing-quality";

export type AdminListingsQualityFilter = "all" | "strong" | "fair" | "needs_work";
export type AdminListingsQualitySort = "default" | "score_desc" | "score_asc";
export type AdminListingsMissingItemFilter =
  | "all"
  | "missing_cover"
  | "missing_images"
  | "missing_description"
  | "missing_price"
  | "missing_location";

type AdminListingsQualityViewOptions = {
  filter: AdminListingsQualityFilter;
  missingItemFilter: AdminListingsMissingItemFilter;
  sort: AdminListingsQualitySort;
};

type QualityMeta = {
  score: number | null;
  status: "Strong" | "Fair" | "Needs work" | null;
  missingFlags: string[];
  hasCoverImage: boolean | null;
  hasMinImages: boolean | null;
  hasDescription: boolean | null;
  hasPrice: boolean | null;
  hasLocation: boolean | null;
};

function getQualityMeta(row: AdminReviewListItem): QualityMeta {
  const score = typeof row.listingQuality?.score === "number" ? row.listingQuality.score : null;
  const status =
    row.listingQualityStatus ?? (typeof score === "number" ? resolveAdminListingQualityStatus(score) : null);
  return {
    score,
    status,
    missingFlags: row.listingQuality?.missingFlags ?? [],
    hasCoverImage:
      typeof row.listingQuality?.has_cover_image === "boolean" ? row.listingQuality.has_cover_image : null,
    hasMinImages: typeof row.listingQuality?.has_min_images === "boolean" ? row.listingQuality.has_min_images : null,
    hasDescription:
      typeof row.listingQuality?.has_description === "boolean" ? row.listingQuality.has_description : null,
    hasPrice: typeof row.listingQuality?.has_price === "boolean" ? row.listingQuality.has_price : null,
    hasLocation: typeof row.listingQuality?.has_location === "boolean" ? row.listingQuality.has_location : null,
  };
}

function matchesQualityFilter(
  filter: AdminListingsQualityFilter,
  status: QualityMeta["status"]
): boolean {
  if (filter === "all") return true;
  if (filter === "strong") return status === "Strong";
  if (filter === "fair") return status === "Fair";
  return status === "Needs work";
}

function matchesMissingItemFilter(
  filter: AdminListingsMissingItemFilter,
  meta: QualityMeta
): boolean {
  if (filter === "all") return true;
  if (filter === "missing_cover") {
    return meta.missingFlags.includes("missing_cover") || meta.hasCoverImage === false;
  }
  if (filter === "missing_images") {
    return meta.missingFlags.includes("missing_images") || meta.hasMinImages === false;
  }
  if (filter === "missing_description") {
    return meta.missingFlags.includes("missing_description") || meta.hasDescription === false;
  }
  if (filter === "missing_price") {
    return meta.missingFlags.includes("missing_price") || meta.hasPrice === false;
  }
  return meta.missingFlags.includes("missing_location") || meta.hasLocation === false;
}

export function applyAdminListingsQualityView(
  rows: AdminReviewListItem[],
  options: AdminListingsQualityViewOptions
): AdminReviewListItem[] {
  const filtered = rows.filter((row) => {
    const meta = getQualityMeta(row);
    // Status and missing-item filters are combined with AND semantics to keep triage precise.
    return (
      matchesQualityFilter(options.filter, meta.status) &&
      matchesMissingItemFilter(options.missingItemFilter, meta)
    );
  });

  if (options.sort === "default") {
    return filtered;
  }

  const direction = options.sort === "score_desc" ? -1 : 1;
  return [...filtered].sort((a, b) => {
    const qa = getQualityMeta(a);
    const qb = getQualityMeta(b);

    if (qa.score === null && qb.score === null) return a.id.localeCompare(b.id);
    if (qa.score === null) return 1;
    if (qb.score === null) return -1;
    if (qa.score !== qb.score) return (qa.score - qb.score) * direction;
    return a.id.localeCompare(b.id);
  });
}
