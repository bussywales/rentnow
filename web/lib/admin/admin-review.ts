import type { ReadinessResult } from "@/lib/properties/listing-readiness";

export type AdminReviewListItem = {
  id: string;
  title: string;
  hostName: string;
  updatedAt: string | null;
  city?: string | null;
  state_region?: string | null;
  country_code?: string | null;
  readiness: ReadinessResult;
  locationQuality: string;
  photoCount: number;
  hasVideo: boolean;
  status?: string | null;
};

export function parseSelectedId(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): string | null {
  if (searchParams instanceof URLSearchParams) {
    const value = searchParams.get("id");
    return value ? decodeURIComponent(value) : null;
  }
  const raw = searchParams?.["id"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? decodeURIComponent(value) : null;
}

export function buildSelectedUrl(pathname: string, id: string | null): string {
  const url = new URL(pathname, "http://localhost");
  if (id) {
    url.searchParams.set("id", id);
  }
  return id ? `${pathname}?id=${encodeURIComponent(id)}` : pathname;
}

export function formatLocationLine(item: Pick<AdminReviewListItem, "city" | "state_region" | "country_code">) {
  const parts = [item.city, item.state_region, item.country_code].filter(Boolean);
  return parts.join(", ");
}

export type AdminReviewFilters = {
  search: string;
  hasVideo: boolean | null;
  needsLocation: boolean;
  needsPhotos: boolean;
  sort: "oldest" | "newest";
};

export function filterAndSortListings(
  items: AdminReviewListItem[],
  view: "pending" | "changes" | "approved" | "all",
  filters: AdminReviewFilters
): AdminReviewListItem[] {
  const { search, hasVideo, needsLocation, needsPhotos, sort } = filters;
  const searchLower = search.trim().toLowerCase();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const filtered = items.filter((item) => {
    if (view === "pending" && item.status !== "pending") return false;
    if (view === "changes" && item.status !== "changes_requested") return false;
    const isApproved = item.status === "live" || item.status === "approved";
    if (view === "approved" && !isApproved) return false;
    if (view === "approved" && item.updatedAt) {
      const updatedMs = new Date(item.updatedAt).getTime();
      if (Number.isFinite(updatedMs) && now - updatedMs > sevenDaysMs) return false;
    }
    if (searchLower) {
      const haystack = `${item.title} ${item.hostName} ${item.city || ""} ${item.state_region || ""} ${item.country_code || ""}`.toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }
    if (hasVideo !== null && item.hasVideo !== hasVideo) return false;
    if (needsLocation && item.locationQuality === "strong") return false;
    if (
      needsPhotos &&
      !item.readiness.issues.some((issue) => issue.action === "photos")
    )
      return false;
    return true;
  });

  return filtered.sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (sort === "oldest") return dateA - dateB;
    if (dateB !== dateA) return dateB - dateA;
    return a.id.localeCompare(b.id);
  });
}
