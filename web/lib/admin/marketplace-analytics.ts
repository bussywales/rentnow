import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataQualitySnapshot } from "@/lib/admin/data-quality";

type CountResult = { count: number | null; error: { message: string } | null };
type DistinctResult<T> = { data: T[] | null; error: { message?: string } | null };

type TrendDelta = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  direction: "up" | "down" | "flat" | "not_available";
};

export type MarketplaceAnalyticsSnapshot = {
  overview: {
    total: number | null;
    live: number | null;
    pending: number | null;
    draft: number | null;
    viewsLast7: number | null;
    uniqueAuthViewersLast7: number | null;
    anonymousViewsLast7: number | null;
    withPhotosPct: number | null;
    withDescriptionPct: number | null;
    withTrustPct: number | null;
    searchesToResults: string | null;
    viewsToEnquiries: string | null;
  };
  trends: {
    listingsCreated: TrendDelta;
    liveListings: TrendDelta;
    listingViews: TrendDelta;
  };
  errors: string[];
};

const toCount = (result: CountResult) => result.count ?? null;

const percent = (part: number | null, total: number | null) => {
  if (part === null || total === null || total === 0) return null;
  return Math.round((part / total) * 100);
};

const buildTrend = (current: number | null, previous: number | null): TrendDelta => {
  if (current === null || previous === null) {
    return { current, previous, delta: null, direction: "not_available" };
  }
  const delta = current - previous;
  const direction = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  return { current, previous, delta, direction };
};

const safeCount = async (
  promise: PromiseLike<CountResult>,
  label: string,
  errors: string[]
) => {
  const result = await promise;
  if (result.error) {
    errors.push(`${label}: ${result.error.message}`);
    return null;
  }
  return result.count ?? null;
};

const safeDistinctCount = async <T extends { viewer_id?: string | null }>(
  promise: PromiseLike<DistinctResult<T>>,
  label: string,
  errors: string[]
) => {
  const result = await promise;
  if (result.error) {
    errors.push(`${label}: ${result.error.message ?? "query_failed"}`);
    return null;
  }
  const distinct = new Set(
    (result.data ?? []).map((row) => row.viewer_id).filter((value) => value)
  );
  return distinct.size;
};

export async function buildMarketplaceAnalytics(
  adminClient: SupabaseClient,
  dataQuality: DataQualitySnapshot | null
): Promise<MarketplaceAnalyticsSnapshot> {
  const errors: string[] = [];

  const collectError = (label: string, result: CountResult) => {
    if (result.error) errors.push(`${label}: ${result.error.message}`);
  };

  const now = Date.now();
  const last7Start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const prev7Start = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalListings,
    liveListings,
    pendingListings,
    draftListings,
    listingsWithDescription,
    listingsCreatedLast7,
    listingsCreatedPrev7,
    liveApprovedLast7,
    liveApprovedPrev7,
    listingViewsLast7,
    listingViewsPrev7,
  ] = await Promise.all([
    adminClient.from("properties").select("id", { count: "exact", head: true }),
    adminClient.from("properties").select("id", { count: "exact", head: true }).eq("status", "live"),
    adminClient.from("properties").select("id", { count: "exact", head: true }).eq("status", "pending"),
    adminClient.from("properties").select("id", { count: "exact", head: true }).eq("status", "draft"),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .not("description", "is", null)
      .neq("description", ""),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .gte("created_at", last7Start),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prev7Start)
      .lt("created_at", last7Start),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "live")
      .gte("approved_at", last7Start),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "live")
      .gte("approved_at", prev7Start)
      .lt("approved_at", last7Start),
    adminClient
      .from("property_views")
      .select("id", { count: "exact", head: true })
      .gte("created_at", last7Start),
    adminClient
      .from("property_views")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prev7Start)
      .lt("created_at", last7Start),
  ]);

  collectError("totalListings", totalListings);
  collectError("liveListings", liveListings);
  collectError("pendingListings", pendingListings);
  collectError("draftListings", draftListings);
  collectError("listingsWithDescription", listingsWithDescription);
  collectError("listingsCreatedLast7", listingsCreatedLast7);
  collectError("listingsCreatedPrev7", listingsCreatedPrev7);
  collectError("liveApprovedLast7", liveApprovedLast7);
  collectError("liveApprovedPrev7", liveApprovedPrev7);
  collectError("listingViewsLast7", listingViewsLast7);
  collectError("listingViewsPrev7", listingViewsPrev7);

  const uniqueAuthViewersLast7 = await safeDistinctCount(
    adminClient
      .from("property_views")
      .select("viewer_id")
      .not("viewer_id", "is", null)
      .gte("created_at", last7Start),
    "uniqueAuthViewersLast7",
    errors
  );

  const anonymousViewsLast7 = await safeCount(
    adminClient
      .from("property_views")
      .select("id", { count: "exact", head: true })
      .is("viewer_id", null)
      .gte("created_at", last7Start),
    "anonymousViewsLast7",
    errors
  );

  let listingsWithTrust: CountResult = { count: null, error: null };
  try {
    listingsWithTrust = await adminClient
      .from("properties")
      .select("id, profiles!inner(id,email_verified,phone_verified,bank_verified)", {
        count: "exact",
        head: true,
      })
      .or(
        "profiles.email_verified.eq.true,profiles.phone_verified.eq.true,profiles.bank_verified.eq.true"
      );
  } catch (err) {
    listingsWithTrust = {
      count: null,
      error: { message: err instanceof Error ? err.message : "Trust badge query failed" },
    };
  }
  collectError("listingsWithTrust", listingsWithTrust);

  const total = toCount(totalListings);
  const missingPhotos = dataQuality?.counts.missingPhotos ?? null;
  const withPhotosCount =
    total !== null && missingPhotos !== null ? Math.max(total - missingPhotos, 0) : null;

  return {
    overview: {
      total,
      live: toCount(liveListings),
      pending: toCount(pendingListings),
      draft: toCount(draftListings),
      viewsLast7: toCount(listingViewsLast7),
      uniqueAuthViewersLast7,
      anonymousViewsLast7,
      withPhotosPct: percent(withPhotosCount, total),
      withDescriptionPct: percent(toCount(listingsWithDescription), total),
      withTrustPct: percent(toCount(listingsWithTrust), total),
      searchesToResults: null,
      viewsToEnquiries: null,
    },
    trends: {
      listingsCreated: buildTrend(
        toCount(listingsCreatedLast7),
        toCount(listingsCreatedPrev7)
      ),
      liveListings: buildTrend(toCount(liveApprovedLast7), toCount(liveApprovedPrev7)),
      listingViews: buildTrend(toCount(listingViewsLast7), toCount(listingViewsPrev7)),
    },
    errors,
  };
}
