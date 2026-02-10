import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_REVIEW_QUEUE_SELECT,
  ADMIN_REVIEW_VIEW_SELECT_MIN,
  ADMIN_REVIEW_VIEW_TABLE,
  normalizeSelect,
} from "@/lib/admin/admin-review-contracts";
import { assertNoForbiddenColumns } from "@/lib/admin/admin-review-schema-allowlist";
import type { AdminListingsQuery } from "@/lib/admin/admin-listings-query";
import {
  parseAdminListingsQuery,
  serializeAdminListingsQuery,
  DEFAULT_ADMIN_LISTINGS_QUERY,
  hasActiveAdminListingsFilters,
  summarizeAdminListingsFilters,
  isUuid,
} from "@/lib/admin/admin-listings-query";
import { ALLOWED_PROPERTY_STATUSES } from "@/lib/admin/admin-review-queue";

export type AdminListingsResult<Row> = {
  rows: Row[];
  count: number;
  page: number;
  pageSize: number;
  contractDegraded: boolean;
};
export {
  parseAdminListingsQuery,
  serializeAdminListingsQuery,
  DEFAULT_ADMIN_LISTINGS_QUERY,
  hasActiveAdminListingsFilters,
  summarizeAdminListingsFilters,
  isUuid,
};

type AdminListingsClient = SupabaseClient;

export async function getAdminAllListings<Row>({
  client,
  query,
  select = ADMIN_REVIEW_QUEUE_SELECT,
}: {
  client: AdminListingsClient;
  query: AdminListingsQuery;
  select?: string;
}): Promise<AdminListingsResult<Row>> {
  const selectNormalizedFull = normalizeSelect(select);
  const selectNormalizedMin = normalizeSelect(ADMIN_REVIEW_VIEW_SELECT_MIN);
  assertNoForbiddenColumns(selectNormalizedFull, "getAdminAllListings");

  const stripColumn = (selectInput: string, column: string) => {
    const parts = normalizeSelect(selectInput)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.filter((part) => part !== column).join(",");
  };

  const runQuery = async ({
    selectToUse,
    supportsDemoFilter,
  }: {
    selectToUse: string;
    supportsDemoFilter: boolean;
  }) => {
    const from = client.from(ADMIN_REVIEW_VIEW_TABLE).select(selectToUse, { count: "exact" });
    let queryBuilder = from;

    if (query.demo !== "all") {
      if (supportsDemoFilter) {
        queryBuilder = queryBuilder.eq("is_demo", query.demo === "true");
      }
    }

    let normalizedStatuses: string[] = [];
    if (query.statuses.length) {
      normalizedStatuses = Array.from(
        new Set(query.statuses.map((status) => status.toLowerCase().trim()).filter(Boolean))
      );
      if (normalizedStatuses.length) {
        queryBuilder = queryBuilder.in("status", normalizedStatuses);
      }
    }
    if (query.active === "true") {
      queryBuilder = queryBuilder.eq("is_active", true);
    }
    if (query.active === "false") {
      queryBuilder = queryBuilder.eq("is_active", false);
    }
    if (query.missingCover) {
      queryBuilder = queryBuilder.or("has_cover.eq.false,cover_image_url.is.null");
    }
    if (query.missingPhotos) {
      queryBuilder = queryBuilder.eq("photo_count", 0);
    }
    if (query.missingLocation) {
      queryBuilder = queryBuilder.or("latitude.is.null,location_label.is.null");
    }
    if (query.priceMin !== null) {
      queryBuilder = queryBuilder.gte("price", query.priceMin);
    }
    if (query.priceMax !== null) {
      queryBuilder = queryBuilder.lte("price", query.priceMax);
    }
    if (query.listing_type) {
      queryBuilder = queryBuilder.eq("listing_type", query.listing_type);
    }
    if (query.bedroomsMin !== null) {
      queryBuilder = queryBuilder.gte("bedrooms", query.bedroomsMin);
    }
    if (query.bedroomsMax !== null) {
      queryBuilder = queryBuilder.lte("bedrooms", query.bedroomsMax);
    }
    if (query.bathroomsMin !== null) {
      queryBuilder = queryBuilder.gte("bathrooms", query.bathroomsMin);
    }
    if (query.bathroomsMax !== null) {
      queryBuilder = queryBuilder.lte("bathrooms", query.bathroomsMax);
    }

    if (query.featured !== "all") {
      const nowIso = new Date().toISOString();
      if (query.featured === "active") {
        queryBuilder = queryBuilder
          .eq("is_featured", true)
          .or(`featured_until.is.null,featured_until.gt.${nowIso}`);
      } else if (query.featured === "expiring") {
        const soonIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        queryBuilder = queryBuilder
          .eq("is_featured", true)
          .gt("featured_until", nowIso)
          .lte("featured_until", soonIso);
      } else if (query.featured === "expired") {
        queryBuilder = queryBuilder.eq("is_featured", true).lte("featured_until", nowIso);
      }
    }

    if (query.q) {
      const trimmed = query.q.trim();
      if (query.qMode === "id") {
        queryBuilder = queryBuilder.eq("id", trimmed);
      } else if (query.qMode === "owner") {
        queryBuilder = queryBuilder.eq("owner_id", trimmed);
      } else if (query.qMode === "title") {
        const escaped = trimmed.replace(/,/g, "\\,");
        const pattern = `%${escaped}%`;
        queryBuilder = queryBuilder.or(
          `title.ilike.${pattern},location_label.ilike.${pattern},city.ilike.${pattern},state_region.ilike.${pattern}`
        );
      }
    }

    const sortMap: Record<AdminListingsQuery["sort"], { field: string; ascending: boolean }> = {
      updated_desc: { field: "updated_at", ascending: false },
      updated_asc: { field: "updated_at", ascending: true },
      created_desc: { field: "created_at", ascending: false },
      created_asc: { field: "created_at", ascending: true },
    };
    const sortConfig = sortMap[query.sort] ?? sortMap.updated_desc;
    queryBuilder = queryBuilder.order(sortConfig.field, { ascending: sortConfig.ascending });

    const fromIndex = (query.page - 1) * query.pageSize;
    const toIndex = fromIndex + query.pageSize - 1;
    queryBuilder = queryBuilder.range(fromIndex, toIndex);

    const result = await queryBuilder;
    if (result.error) throw result.error;
    const rows = Array.isArray(result.data) ? (result.data as Row[]) : [];
    if (normalizedStatuses.length) {
      const mismatched = rows.filter((row) => {
        const status = (row as { status?: string | null })?.status;
        if (!status) return true;
        return !normalizedStatuses.includes(status.toLowerCase());
      });
      if (mismatched.length) {
        throw new Error(
          `Status filter mismatch: expected ${normalizedStatuses.join(", ")}`
        );
      }
    }
    return { rows, count: result.count ?? rows.length };
  };

  let contractDegraded = false;
  try {
    const { rows, count } = await runQuery({
      selectToUse: selectNormalizedFull,
      supportsDemoFilter: true,
    });
    return {
      rows,
      count,
      page: query.page,
      pageSize: query.pageSize,
      contractDegraded,
    };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42703" || /does not exist/i.test((err as { message?: string })?.message ?? "")) {
      contractDegraded = true;
      try {
        const { rows, count } = await runQuery({
          selectToUse: selectNormalizedMin,
          supportsDemoFilter: true,
        });
        return {
          rows,
          count,
          page: query.page,
          pageSize: query.pageSize,
          contractDegraded,
        };
      } catch (retryErr) {
        const retryCode = (retryErr as { code?: string })?.code;
        if (
          retryCode === "42703" ||
          /does not exist/i.test((retryErr as { message?: string })?.message ?? "")
        ) {
          // Last-resort: drop is_demo from the select and disable demo filter.
          const selectWithoutDemo = stripColumn(selectNormalizedMin, "is_demo");
          const { rows, count } = await runQuery({
            selectToUse: selectWithoutDemo,
            supportsDemoFilter: false,
          });
          return {
            rows,
            count,
            page: query.page,
            pageSize: query.pageSize,
            contractDegraded,
          };
        }
        throw retryErr;
      }
    }
    throw err;
  }
}

export type ListingStats<Row> = {
  total: number;
  statusCounts: Record<string, number>;
  activeCounts: { active: number; inactive: number };
  recent: Row[];
  error: string | null;
};

export async function getAdminListingStats<Row>({
  client,
  recentLimit = 10,
}: {
  client: AdminListingsClient;
  recentLimit?: number;
}): Promise<ListingStats<Row>> {
  const statusCounts: Record<string, number> = {};
  const activeCounts = { active: 0, inactive: 0 };
  let total = 0;
  let recent: Row[] = [];
  let error: string | null = null;

  try {
    const totalResult = await client
      .from(ADMIN_REVIEW_VIEW_TABLE)
      .select("id", { count: "exact", head: true });
    total = totalResult.count ?? 0;

    await Promise.all(
      (ALLOWED_PROPERTY_STATUSES as readonly string[]).map(async (status) => {
        const result = await client
          .from(ADMIN_REVIEW_VIEW_TABLE)
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        statusCounts[status] = result.count ?? 0;
      })
    );

    const activeResult = await client
      .from(ADMIN_REVIEW_VIEW_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    activeCounts.active = activeResult.count ?? 0;

    const inactiveResult = await client
      .from(ADMIN_REVIEW_VIEW_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("is_active", false);
    activeCounts.inactive = inactiveResult.count ?? 0;

    const recentResult = await client
      .from(ADMIN_REVIEW_VIEW_TABLE)
      .select(normalizeSelect(ADMIN_REVIEW_VIEW_SELECT_MIN))
      .order("updated_at", { ascending: false })
      .limit(recentLimit);
    recent = (recentResult.data as Row[]) ?? [];
  } catch (err) {
    error = (err as Error)?.message ?? "stats fetch failed";
  }

  return { total, statusCounts, activeCounts, recent, error };
}
