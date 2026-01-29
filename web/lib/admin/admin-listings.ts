import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_REVIEW_QUEUE_SELECT,
  ADMIN_REVIEW_VIEW_SELECT_MIN,
  ADMIN_REVIEW_VIEW_TABLE,
  normalizeSelect,
} from "@/lib/admin/admin-review-contracts";
import { assertNoForbiddenColumns } from "@/lib/admin/admin-review-schema-allowlist";
import { ALLOWED_PROPERTY_STATUSES, normalizeStatus } from "@/lib/admin/admin-review-queue";

export type AdminListingsQuery = {
  q: string | null;
  qMode: "id" | "owner" | "title";
  statuses: string[];
  active: "all" | "true" | "false";
  page: number;
  pageSize: number;
  sort: "updated_desc" | "updated_asc" | "created_desc" | "created_asc";
  missingCover: boolean;
  missingPhotos: boolean;
  missingLocation: boolean;
  priceMin: number | null;
  priceMax: number | null;
};

export type AdminListingsResult<Row> = {
  rows: Row[];
  count: number;
  page: number;
  pageSize: number;
  contractDegraded: boolean;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export function parseAdminListingsQuery(
  params: Record<string, string | string[] | undefined>
): AdminListingsQuery {
  const readValue = (key: string) => {
    const value = params[key];
    if (Array.isArray(value)) return value[value.length - 1] ?? null;
    return value ?? null;
  };

  const q = (readValue("q") ?? "").trim() || null;
  const qModeRaw = (readValue("qMode") ?? "").toLowerCase();
  let qMode: AdminListingsQuery["qMode"] =
    qModeRaw === "id" || qModeRaw === "owner" || qModeRaw === "title" ? qModeRaw : "title";
  if (!qModeRaw && q && isUuid(q)) {
    qMode = "id";
  }

  const statusParam = params["status"];
  const statusValues = Array.isArray(statusParam)
    ? statusParam
    : typeof statusParam === "string" && statusParam.length
      ? statusParam.split(",")
      : [];
  const statuses = Array.from(
    new Set(
      statusValues
        .map((s) => normalizeStatus(s))
        .filter((s): s is string => !!s)
        .filter((s) => (ALLOWED_PROPERTY_STATUSES as readonly string[]).includes(s))
    )
  );

  const activeRaw = (readValue("active") ?? "").toLowerCase();
  const active: AdminListingsQuery["active"] =
    activeRaw === "true" || activeRaw === "active"
      ? "true"
      : activeRaw === "false" || activeRaw === "inactive"
        ? "false"
        : "all";

  const pageRaw = Number(readValue("page"));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const pageSizeRaw = Number(readValue("pageSize"));
  const pageSizeCandidate =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(pageSizeCandidate, 10), MAX_PAGE_SIZE);

  const sortRaw = (readValue("sort") ?? "").toLowerCase();
  const sort: AdminListingsQuery["sort"] =
    sortRaw === "updated_asc" || sortRaw === "updated_at.asc"
      ? "updated_asc"
      : sortRaw === "created_desc"
        ? "created_desc"
        : sortRaw === "created_asc"
          ? "created_asc"
          : "updated_desc";

  const parseBool = (value: string | null) => {
    if (!value) return false;
    const normalized = value.toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  };
  const missingCover = parseBool(readValue("missingCover"));
  const missingPhotos = parseBool(readValue("missingPhotos"));
  const missingLocation = parseBool(readValue("missingLocation"));
  const priceMinValue = readValue("priceMin");
  const priceMaxValue = readValue("priceMax");
  const priceMinRaw = priceMinValue ? Number(priceMinValue) : Number.NaN;
  const priceMaxRaw = priceMaxValue ? Number(priceMaxValue) : Number.NaN;
  const priceMin = Number.isFinite(priceMinRaw) ? priceMinRaw : null;
  const priceMax = Number.isFinite(priceMaxRaw) ? priceMaxRaw : null;

  return {
    q,
    qMode,
    statuses,
    active,
    page,
    pageSize,
    sort,
    missingCover,
    missingPhotos,
    missingLocation,
    priceMin,
    priceMax,
  };
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

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

  const runQuery = async (useMin = false) => {
    const selectToUse = useMin ? selectNormalizedMin : selectNormalizedFull;
    const from = client.from(ADMIN_REVIEW_VIEW_TABLE).select(selectToUse, { count: "exact" });
    let queryBuilder = from;

    if (query.statuses.length) {
      queryBuilder = queryBuilder.in("status", query.statuses);
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
    return { rows, count: result.count ?? rows.length };
  };

  let contractDegraded = false;
  try {
    const { rows, count } = await runQuery(false);
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
      const { rows, count } = await runQuery(true);
      return {
        rows,
        count,
        page: query.page,
        pageSize: query.pageSize,
        contractDegraded,
      };
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
