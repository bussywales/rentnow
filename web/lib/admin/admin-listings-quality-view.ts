import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { resolveAdminListingQualityStatus } from "@/lib/admin/listing-quality";

export type AdminListingsQualityFilter = "all" | "strong" | "fair" | "needs_work";
export type AdminListingsQualitySort = "default" | "score_desc" | "score_asc";

type AdminListingsQualityViewOptions = {
  filter: AdminListingsQualityFilter;
  sort: AdminListingsQualitySort;
};

type QualityMeta = {
  score: number | null;
  status: "Strong" | "Fair" | "Needs work" | null;
};

function getQualityMeta(row: AdminReviewListItem): QualityMeta {
  const score = typeof row.listingQuality?.score === "number" ? row.listingQuality.score : null;
  const status =
    row.listingQualityStatus ?? (typeof score === "number" ? resolveAdminListingQualityStatus(score) : null);
  return { score, status };
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

export function applyAdminListingsQualityView(
  rows: AdminReviewListItem[],
  options: AdminListingsQualityViewOptions
): AdminReviewListItem[] {
  const filtered = rows.filter((row) => {
    const { status } = getQualityMeta(row);
    return matchesQualityFilter(options.filter, status);
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
