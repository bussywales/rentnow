import {
  getPropertyRequestLocationSummary,
  type PropertyRequest,
  type PropertyRequestStatus,
} from "@/lib/requests/property-requests";

export type AdminPropertyRequestListFilters = {
  q: string;
  status: PropertyRequestStatus | "all";
};

export type PropertyRequestAnalyticsResponseRow = {
  id: string;
  request_id: string;
  responder_user_id: string;
  created_at: string;
};

export type PropertyRequestResponseSummary = {
  responseCount: number;
  responderCount: number;
  firstResponseAt: string | null;
  latestResponseAt: string | null;
  hoursToFirstResponse: number | null;
};

export type PropertyRequestAdminAnalytics = {
  requestsCreated: number;
  openRequests: number;
  closedRequests: number;
  expiredRequests: number;
  removedRequests: number;
  requestsWithResponses: number;
  requestsWithoutResponses: number;
  totalResponsesSent: number;
  averageFirstResponseHours: number | null;
  medianFirstResponseHours: number | null;
};

export function parseAdminPropertyRequestListFilters(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): AdminPropertyRequestListFilters {
  const read = (key: string) => {
    if (input instanceof URLSearchParams) return input.get(key);
    const value = input[key];
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  };

  const rawStatus = read("status");
  const normalizedStatus = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";
  const status =
    normalizedStatus === "draft" ||
    normalizedStatus === "open" ||
    normalizedStatus === "matched" ||
    normalizedStatus === "closed" ||
    normalizedStatus === "expired" ||
    normalizedStatus === "removed"
      ? normalizedStatus
      : "all";

  return {
    q: (read("q") ?? "").trim(),
    status,
  };
}

export function matchesAdminPropertyRequestListFilters(
  request: PropertyRequest,
  filters: AdminPropertyRequestListFilters
): boolean {
  if (filters.status !== "all" && request.status !== filters.status) {
    return false;
  }

  const needle = filters.q.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    request.id,
    request.intent,
    request.marketCode,
    request.city,
    request.area,
    request.locationText,
    request.propertyType,
    request.moveTimeline,
    request.notes,
    getPropertyRequestLocationSummary(request),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle] ?? null;
}

export function buildPropertyRequestResponseSummaryMap(
  requests: PropertyRequest[],
  responses: PropertyRequestAnalyticsResponseRow[]
): Map<string, PropertyRequestResponseSummary> {
  const requestCreatedAt = new Map(requests.map((request) => [request.id, Date.parse(request.createdAt)]));
  const grouped = new Map<string, PropertyRequestAnalyticsResponseRow[]>();

  for (const response of responses) {
    const current = grouped.get(response.request_id) ?? [];
    current.push(response);
    grouped.set(response.request_id, current);
  }

  const summary = new Map<string, PropertyRequestResponseSummary>();
  for (const request of requests) {
    const rows = grouped.get(request.id) ?? [];
    const sorted = [...rows].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const first = sorted[0]?.created_at ?? null;
    const latest = sorted[sorted.length - 1]?.created_at ?? null;
    const firstTs = first ? Date.parse(first) : Number.NaN;
    const createdTs = requestCreatedAt.get(request.id) ?? Number.NaN;
    const hoursToFirstResponse =
      first && Number.isFinite(firstTs) && Number.isFinite(createdTs)
        ? Math.max(0, (firstTs - createdTs) / (1000 * 60 * 60))
        : null;

    summary.set(request.id, {
      responseCount: rows.length,
      responderCount: new Set(rows.map((row) => row.responder_user_id)).size,
      firstResponseAt: first,
      latestResponseAt: latest,
      hoursToFirstResponse,
    });
  }

  return summary;
}

export function buildPropertyRequestAdminAnalytics(
  requests: PropertyRequest[],
  responses: PropertyRequestAnalyticsResponseRow[]
): PropertyRequestAdminAnalytics {
  const summary = buildPropertyRequestResponseSummaryMap(requests, responses);
  const nonDraftRequests = requests.filter((request) => request.status !== "draft");
  const firstResponseHours = nonDraftRequests
    .map((request) => summary.get(request.id)?.hoursToFirstResponse ?? null)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const requestsWithResponses = nonDraftRequests.filter(
    (request) => (summary.get(request.id)?.responseCount ?? 0) > 0
  ).length;

  return {
    requestsCreated: requests.length,
    openRequests: requests.filter((request) => request.status === "open").length,
    closedRequests: requests.filter((request) => request.status === "closed").length,
    expiredRequests: requests.filter((request) => request.status === "expired").length,
    removedRequests: requests.filter((request) => request.status === "removed").length,
    requestsWithResponses,
    requestsWithoutResponses: nonDraftRequests.length - requestsWithResponses,
    totalResponsesSent: responses.length,
    averageFirstResponseHours:
      firstResponseHours.length > 0
        ? firstResponseHours.reduce((sum, value) => sum + value, 0) / firstResponseHours.length
        : null,
    medianFirstResponseHours: median(firstResponseHours),
  };
}
