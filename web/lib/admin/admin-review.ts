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
