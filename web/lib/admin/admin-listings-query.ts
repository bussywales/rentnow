import { ALLOWED_PROPERTY_STATUSES, normalizeStatus } from "@/lib/admin/admin-review-queue";

export type AdminListingsQuery = {
  q: string | null;
  qMode: "id" | "owner" | "title";
  statuses: string[];
  active: "all" | "true" | "false";
  demo: "all" | "true" | "false";
  featured: "all" | "active" | "expiring" | "expired";
  page: number;
  pageSize: number;
  sort: "updated_desc" | "updated_asc" | "created_desc" | "created_asc";
  missingCover: boolean;
  missingPhotos: boolean;
  missingLocation: boolean;
  priceMin: number | null;
  priceMax: number | null;
  listing_type: string | null;
  bedroomsMin: number | null;
  bedroomsMax: number | null;
  bathroomsMin: number | null;
  bathroomsMax: number | null;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export const DEFAULT_ADMIN_LISTINGS_QUERY: AdminListingsQuery = {
  q: null,
  qMode: "title",
  statuses: [],
  active: "all",
  demo: "all",
  featured: "all",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sort: "updated_desc",
  missingCover: false,
  missingPhotos: false,
  missingLocation: false,
  priceMin: null,
  priceMax: null,
  listing_type: null,
  bedroomsMin: null,
  bedroomsMax: null,
  bathroomsMin: null,
  bathroomsMax: null,
};

type ParamBag = Record<string, string | string[] | undefined>;

function readParam(params: ParamBag, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[value.length - 1] ?? null;
  return value ?? null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

const parseBool = (value: string | null) => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
};

const parseNullableNumber = (value: string | null) => {
  if (value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeMulti = (value: string | string[] | undefined) => {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return rawValues
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export function parseAdminListingsQuery(
  params: ParamBag | URLSearchParams
): AdminListingsQuery {
  const bag: ParamBag =
    params instanceof URLSearchParams
      ? Array.from(params.entries()).reduce<ParamBag>((acc, [key, value]) => {
          const existing = acc[key];
          if (existing === undefined) {
            acc[key] = value;
          } else if (Array.isArray(existing)) {
            existing.push(value);
            acc[key] = existing;
          } else {
            acc[key] = [existing, value];
          }
          return acc;
        }, {})
      : params;

  const q = (readParam(bag, "q") ?? "").trim() || null;
  const qModeRaw = (readParam(bag, "qMode") ?? "").toLowerCase();
  let qMode: AdminListingsQuery["qMode"] =
    qModeRaw === "id" || qModeRaw === "owner" || qModeRaw === "title" ? qModeRaw : "title";
  if (q && isUuid(q) && (qModeRaw === "" || qModeRaw === "title")) {
    qMode = "id";
  }

  const statusValues = normalizeMulti(
    bag.status ?? bag.statuses ?? (bag["status[]"] as string | string[] | undefined)
  );
  const statuses = Array.from(
    new Set(
      statusValues
        .map((status) => normalizeStatus(status))
        .filter((status): status is string => !!status)
        .filter((status) => (ALLOWED_PROPERTY_STATUSES as readonly string[]).includes(status))
    )
  );

  const activeRaw = (readParam(bag, "active") ?? "").toLowerCase();
  const active: AdminListingsQuery["active"] =
    activeRaw === "true" || activeRaw === "active"
      ? "true"
      : activeRaw === "false" || activeRaw === "inactive"
        ? "false"
        : "all";
  const demoRaw = (readParam(bag, "demo") ?? "").toLowerCase();
  const demo: AdminListingsQuery["demo"] =
    demoRaw === "true" || demoRaw === "demo"
      ? "true"
      : demoRaw === "false" || demoRaw === "not_demo"
        ? "false"
        : "all";

  const featuredActive = parseBool(readParam(bag, "featured"));
  const featuredExpiring = parseBool(readParam(bag, "expiring"));
  const featuredExpired = parseBool(readParam(bag, "expired"));
  const featured: AdminListingsQuery["featured"] = featuredExpiring
    ? "expiring"
    : featuredExpired
      ? "expired"
      : featuredActive
        ? "active"
        : "all";

  const pageRaw = Number(readParam(bag, "page"));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const pageSizeRaw = Number(readParam(bag, "pageSize"));
  const pageSizeCandidate =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(pageSizeCandidate, 10), MAX_PAGE_SIZE);

  const sortRaw = (readParam(bag, "sort") ?? "").toLowerCase();
  const sort: AdminListingsQuery["sort"] =
    sortRaw === "updated_asc" || sortRaw === "updated_at.asc"
      ? "updated_asc"
      : sortRaw === "created_desc"
        ? "created_desc"
        : sortRaw === "created_asc"
          ? "created_asc"
          : "updated_desc";

  const listingType = (readParam(bag, "listing_type") ?? "").trim() || null;

  return {
    q,
    qMode,
    statuses,
    active,
    demo,
    featured,
    page,
    pageSize,
    sort,
    missingCover: parseBool(readParam(bag, "missingCover")),
    missingPhotos: parseBool(readParam(bag, "missingPhotos")),
    missingLocation: parseBool(readParam(bag, "missingLocation")),
    priceMin: parseNullableNumber(readParam(bag, "priceMin")),
    priceMax: parseNullableNumber(readParam(bag, "priceMax")),
    listing_type: listingType,
    bedroomsMin: parseNullableNumber(readParam(bag, "bedroomsMin")),
    bedroomsMax: parseNullableNumber(readParam(bag, "bedroomsMax")),
    bathroomsMin: parseNullableNumber(readParam(bag, "bathroomsMin")),
    bathroomsMax: parseNullableNumber(readParam(bag, "bathroomsMax")),
  };
}

export function serializeAdminListingsQuery(query: AdminListingsQuery): URLSearchParams {
  const params = new URLSearchParams();
  const appendIf = (key: string, value: string | number | null) => {
    if (value === null || value === undefined || value === "") return;
    params.set(key, String(value));
  };

  if (query.q) {
    appendIf("q", query.q);
    appendIf("qMode", query.qMode);
  }

  if (query.statuses.length) {
    const normalizedStatuses = Array.from(
      new Set(
        query.statuses
          .map((status) => normalizeStatus(status))
          .filter((status): status is string => !!status)
          .filter((status) => (ALLOWED_PROPERTY_STATUSES as readonly string[]).includes(status))
      )
    ).sort();
    if (normalizedStatuses.length) {
      params.set("status", normalizedStatuses.join(","));
    }
  }

  if (query.active !== "all") {
    appendIf("active", query.active);
  }
  if (query.demo !== "all") {
    appendIf("demo", query.demo);
  }

  if (query.featured === "active") {
    appendIf("featured", 1);
  } else if (query.featured === "expiring") {
    appendIf("expiring", 1);
  } else if (query.featured === "expired") {
    appendIf("expired", 1);
  }

  if (query.missingCover) params.set("missingCover", "true");
  if (query.missingPhotos) params.set("missingPhotos", "true");
  if (query.missingLocation) params.set("missingLocation", "true");

  appendIf("priceMin", query.priceMin);
  appendIf("priceMax", query.priceMax);
  appendIf("listing_type", query.listing_type);
  appendIf("bedroomsMin", query.bedroomsMin);
  appendIf("bedroomsMax", query.bedroomsMax);
  appendIf("bathroomsMin", query.bathroomsMin);
  appendIf("bathroomsMax", query.bathroomsMax);

  if (query.sort !== DEFAULT_ADMIN_LISTINGS_QUERY.sort) {
    appendIf("sort", query.sort);
  }
  if (query.page > 1) {
    appendIf("page", query.page);
  }
  if (query.pageSize !== DEFAULT_ADMIN_LISTINGS_QUERY.pageSize) {
    appendIf("pageSize", query.pageSize);
  }

  return params;
}

export function hasActiveAdminListingsFilters(query: AdminListingsQuery) {
  return Boolean(
    query.q ||
      query.statuses.length ||
      query.active !== "all" ||
      query.demo !== "all" ||
      query.featured !== "all" ||
      query.missingCover ||
      query.missingPhotos ||
      query.missingLocation ||
      query.priceMin !== null ||
      query.priceMax !== null ||
      query.listing_type ||
      query.bedroomsMin !== null ||
      query.bedroomsMax !== null ||
      query.bathroomsMin !== null ||
      query.bathroomsMax !== null
  );
}

export function summarizeAdminListingsFilters(query: AdminListingsQuery): string[] {
  const summary: string[] = [];
  if (query.q) {
    summary.push(`Search: ${query.q}`);
  }
  if (query.statuses.length) {
    summary.push(`Status: ${query.statuses.join(", ")}`);
  }
  if (query.active !== "all") {
    summary.push(`Active: ${query.active === "true" ? "yes" : "no"}`);
  }
  if (query.demo !== "all") {
    summary.push(`Demo: ${query.demo === "true" ? "only demo" : "hide demo"}`);
  }
  if (query.featured !== "all") {
    const label =
      query.featured === "active"
        ? "Featured only"
        : query.featured === "expiring"
          ? "Featured expiring soon"
          : "Featured expired";
    summary.push(label);
  }
  if (query.missingCover) summary.push("Missing cover");
  if (query.missingPhotos) summary.push("Missing photos");
  if (query.missingLocation) summary.push("Missing location");
  if (query.priceMin !== null || query.priceMax !== null) {
    summary.push(
      `Price: ${query.priceMin ?? "–"} to ${query.priceMax ?? "–"}`
    );
  }
  if (query.listing_type) summary.push(`Type: ${query.listing_type}`);
  if (query.bedroomsMin !== null || query.bedroomsMax !== null) {
    summary.push(
      `Beds: ${query.bedroomsMin ?? "–"} to ${query.bedroomsMax ?? "–"}`
    );
  }
  if (query.bathroomsMin !== null || query.bathroomsMax !== null) {
    summary.push(
      `Baths: ${query.bathroomsMin ?? "–"} to ${query.bathroomsMax ?? "–"}`
    );
  }
  return summary;
}
