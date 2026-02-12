import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseFeaturedRequestDuration,
  type FeaturedRequestDuration,
  type FeaturedRequestStatus,
} from "@/lib/featured/requests";

export type FeaturedRequestFilters = {
  status?: FeaturedRequestStatus | "all";
  timeframe?: "7d" | "30d" | "all";
  q?: string;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

export type FeaturedRequestPropertySummary = {
  id: string;
  title: string;
  city: string | null;
  price: number | null;
  currency: string | null;
  status: string | null;
  is_active: boolean | null;
  is_approved: boolean | null;
  expires_at: string | null;
  is_demo: boolean | null;
  is_featured: boolean | null;
  featured_until: string | null;
};

export type FeaturedRequestQueueRow = {
  id: string;
  property_id: string;
  requester_user_id: string;
  requester_role: "agent" | "landlord";
  duration_days: FeaturedRequestDuration;
  requested_until: string | null;
  note: string | null;
  status: FeaturedRequestStatus;
  admin_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  property: FeaturedRequestPropertySummary | null;
  requester: {
    id: string;
    full_name: string | null;
  };
};

export type OwnerFeaturedRequestState = {
  id: string;
  property_id: string;
  duration_days: FeaturedRequestDuration;
  requested_until: string | null;
  note: string | null;
  status: FeaturedRequestStatus;
  admin_note: string | null;
  decided_at: string | null;
  created_at: string | null;
};

type RawFeaturedRequestRow = {
  id: string;
  property_id: string;
  requester_user_id: string;
  requester_role: string;
  duration_days: number | null;
  requested_until: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

type RawPropertySummary = FeaturedRequestPropertySummary;
type RawOwnerFeaturedRequestRow = {
  id: string;
  property_id: string;
  duration_days: number | null;
  requested_until: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  decided_at: string | null;
  created_at: string | null;
};

function normalizeStatus(value: string | null | undefined): FeaturedRequestStatus | "all" {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "approved" ||
    normalized === "rejected" ||
    normalized === "cancelled"
  ) {
    return normalized;
  }
  return "all";
}

function normalizeTimeframe(value: string | null | undefined): "7d" | "30d" | "all" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "7d" || normalized === "30d" || normalized === "all") return normalized;
  return "30d";
}

function normalizeLimit(value: string | null | undefined, fallback = 200): number {
  const raw = Number(value || fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(1000, Math.trunc(raw)));
}

function timeframeStartIso(timeframe: "7d" | "30d" | "all"): string | null {
  if (timeframe === "all") return null;
  const days = timeframe === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function parseFeaturedRequestFilters(searchParams: URLSearchParams): FeaturedRequestFilters {
  const status = normalizeStatus(searchParams.get("status"));
  const timeframe = normalizeTimeframe(searchParams.get("timeframe"));
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = String(searchParams.get("q") || "").trim();

  return {
    status,
    timeframe,
    q,
    from: from ? from.trim() : null,
    to: to ? to.trim() : null,
    limit: normalizeLimit(searchParams.get("limit"), 200),
  };
}

export function resolveFeaturedUntil(durationDays: FeaturedRequestDuration, now: Date = new Date()): string | null {
  if (durationDays === null) return null;
  return new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

export function durationLabel(durationDays: FeaturedRequestDuration): string {
  if (durationDays === 7) return "7 days";
  if (durationDays === 30) return "30 days";
  return "No expiry";
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function appendUtcDay(toDateIso: string): string {
  const parsed = Date.parse(toDateIso);
  if (!Number.isFinite(parsed)) return toDateIso;
  return new Date(parsed + 24 * 60 * 60 * 1000 - 1).toISOString();
}

export async function fetchFeaturedRequestsQueue(input: {
  client: SupabaseClient;
  filters: FeaturedRequestFilters;
}): Promise<FeaturedRequestQueueRow[]> {
  const status = normalizeStatus(input.filters.status);
  const timeframe = normalizeTimeframe(input.filters.timeframe);
  const limit = Number.isFinite(input.filters.limit || 0)
    ? Math.max(1, Math.min(1000, Math.trunc(input.filters.limit || 200)))
    : 200;

  const fromIso = toIsoDate(input.filters.from || null);
  const toIsoBase = toIsoDate(input.filters.to || null);
  const timeframeIso = timeframeStartIso(timeframe);
  const sinceIso = fromIso || timeframeIso;
  const untilIso = toIsoBase ? appendUtcDay(toIsoBase) : null;

  let query = input.client
    .from("featured_requests")
    .select(
      "id,property_id,requester_user_id,requester_role,duration_days,requested_until,note,status,admin_note,decided_by,decided_at,created_at,updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (sinceIso) {
    query = query.gte("created_at", sinceIso);
  }
  if (untilIso) {
    query = query.lte("created_at", untilIso);
  }

  const q = String(input.filters.q || "").trim();
  if (q) {
    const lowered = q.toLowerCase();
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q);
    if (uuidLike) {
      query = query.or(`property_id.eq.${lowered},requester_user_id.eq.${lowered},id.eq.${lowered}`);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Unable to load featured requests.");
  }

  const rows = (data as RawFeaturedRequestRow[] | null) ?? [];
  if (!rows.length) return [];

  const propertyIds = Array.from(new Set(rows.map((row) => row.property_id).filter(Boolean)));
  const requesterIds = Array.from(new Set(rows.map((row) => row.requester_user_id).filter(Boolean)));

  const [propertyResult, requesterResult] = await Promise.all([
    propertyIds.length
      ? input.client
          .from("properties")
          .select(
            "id,title,city,price,currency,status,is_active,is_approved,expires_at,is_demo,is_featured,featured_until"
          )
          .in("id", propertyIds)
      : Promise.resolve({ data: [] as RawPropertySummary[] | null }),
    requesterIds.length
      ? input.client.from("profiles").select("id,full_name").in("id", requesterIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> | null }),
  ]);

  const propertyMap = new Map<string, RawPropertySummary>();
  for (const property of ((propertyResult.data as RawPropertySummary[] | null) ?? [])) {
    propertyMap.set(property.id, property);
  }

  const requesterMap = new Map<string, { id: string; full_name: string | null }>();
  for (const requester of
    ((requesterResult.data as Array<{ id: string; full_name: string | null }> | null) ?? [])) {
    requesterMap.set(requester.id, {
      id: requester.id,
      full_name: requester.full_name ?? null,
    });
  }

  let mapped = rows.map<FeaturedRequestQueueRow>((row) => {
    const normalizedStatus = normalizeStatus(row.status);
    return {
      id: row.id,
      property_id: row.property_id,
      requester_user_id: row.requester_user_id,
      requester_role: row.requester_role === "landlord" ? "landlord" : "agent",
      duration_days: parseFeaturedRequestDuration(row.duration_days),
      requested_until: row.requested_until ?? null,
      note: row.note ?? null,
      status: normalizedStatus === "all" ? "pending" : normalizedStatus,
      admin_note: row.admin_note ?? null,
      decided_by: row.decided_by ?? null,
      decided_at: row.decided_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      property: propertyMap.get(row.property_id) ?? null,
      requester: requesterMap.get(row.requester_user_id) ?? {
        id: row.requester_user_id,
        full_name: null,
      },
    };
  });

  if (q) {
    const queryLower = q.toLowerCase();
    mapped = mapped.filter((row) => {
      const requestId = row.id.toLowerCase();
      const propertyId = row.property_id.toLowerCase();
      const requesterId = row.requester_user_id.toLowerCase();
      const propertyTitle = row.property?.title?.toLowerCase() || "";
      const requesterName = row.requester.full_name?.toLowerCase() || "";
      return (
        requestId.includes(queryLower) ||
        propertyId.includes(queryLower) ||
        requesterId.includes(queryLower) ||
        propertyTitle.includes(queryLower) ||
        requesterName.includes(queryLower)
      );
    });
  }

  return mapped;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildFeaturedRequestsCsv(rows: FeaturedRequestQueueRow[]): string {
  const header = [
    "request_id",
    "property_id",
    "property_title",
    "requester_user_id",
    "requester_name",
    "requester_role",
    "status",
    "duration_days",
    "requested_until",
    "created_at",
    "decided_at",
    "admin_note",
    "property_city",
    "property_price",
    "property_currency",
  ];

  const lines = rows.map((row) =>
    [
      row.id,
      row.property_id,
      row.property?.title ?? "",
      row.requester_user_id,
      row.requester.full_name ?? "",
      row.requester_role,
      row.status,
      row.duration_days ?? "",
      row.requested_until ?? "",
      row.created_at,
      row.decided_at ?? "",
      row.admin_note ?? "",
      row.property?.city ?? "",
      row.property?.price ?? "",
      row.property?.currency ?? "",
    ]
      .map(csvEscape)
      .join(",")
  );

  return [header.join(","), ...lines].join("\n");
}

function requestPriority(status: FeaturedRequestStatus): number {
  if (status === "pending") return 2;
  if (status === "approved" || status === "rejected" || status === "cancelled") return 1;
  return 0;
}

function requestSortTime(row: { decided_at: string | null; created_at: string | null }): number {
  const decidedMs = Date.parse(row.decided_at || "");
  if (Number.isFinite(decidedMs)) return decidedMs;
  const createdMs = Date.parse(row.created_at || "");
  if (Number.isFinite(createdMs)) return createdMs;
  return 0;
}

export function selectLatestFeaturedRequestsByProperty(
  rows: OwnerFeaturedRequestState[]
): Record<string, OwnerFeaturedRequestState> {
  const map = new Map<string, OwnerFeaturedRequestState>();

  for (const row of rows) {
    if (!row.property_id) continue;
    const existing = map.get(row.property_id);
    if (!existing) {
      map.set(row.property_id, row);
      continue;
    }

    const existingPriority = requestPriority(existing.status);
    const candidatePriority = requestPriority(row.status);
    if (candidatePriority > existingPriority) {
      map.set(row.property_id, row);
      continue;
    }
    if (candidatePriority < existingPriority) continue;

    if (requestSortTime(row) > requestSortTime(existing)) {
      map.set(row.property_id, row);
    }
  }

  return Object.fromEntries(map.entries());
}

export async function getFeaturedRequestsForOwnerProperties(input: {
  client: SupabaseClient;
  propertyIds: string[];
}): Promise<Record<string, OwnerFeaturedRequestState>> {
  const propertyIds = Array.from(new Set(input.propertyIds.filter(Boolean)));
  if (!propertyIds.length) return {};

  const { data, error } = await input.client
    .from("featured_requests")
    .select(
      "id,property_id,duration_days,requested_until,note,status,admin_note,decided_at,created_at"
    )
    .in("property_id", propertyIds)
    .in("status", ["pending", "approved", "rejected", "cancelled"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load featured request states.");
  }

  const rows = (data as RawOwnerFeaturedRequestRow[] | null) ?? [];
  const normalizedRows: OwnerFeaturedRequestState[] = [];

  for (const row of rows) {
    if (!row.property_id) continue;
    const normalizedStatus = normalizeStatus(row.status);
    const status = normalizedStatus === "all" ? "pending" : normalizedStatus;
    normalizedRows.push({
      id: row.id,
      property_id: row.property_id,
      duration_days: parseFeaturedRequestDuration(row.duration_days),
      requested_until: row.requested_until ?? null,
      note: row.note ?? null,
      status,
      admin_note: row.admin_note ?? null,
      decided_at: row.decided_at ?? null,
      created_at: row.created_at ?? null,
    });
  }

  return selectLatestFeaturedRequestsByProperty(normalizedRows);
}
