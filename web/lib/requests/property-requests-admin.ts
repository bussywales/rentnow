import {
  getPropertyRequestLocationSummary,
  getPropertyRequestIntentLabel,
  type PropertyRequest,
  type PropertyRequestIntent,
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
  requestsPublished: number;
  openRequests: number;
  matchedRequests: number;
  closedRequests: number;
  expiredRequests: number;
  removedRequests: number;
  requestsWithResponses: number;
  requestsWithoutResponses: number;
  totalResponsesSent: number;
  responseRate: number | null;
  averageFirstResponseHours: number | null;
  medianFirstResponseHours: number | null;
};

export type PropertyRequestTelemetryBreakdownRow = {
  key: string;
  label: string;
  requestsCreated: number;
  requestsPublished: number;
  openRequests: number;
  matchedRequests: number;
  closedRequests: number;
  expiredRequests: number;
  removedRequests: number;
  requestsWithResponses: number;
  requestsWithoutResponses: number;
  totalResponsesSent: number;
  responseRate: number | null;
  averageFirstResponseHours: number | null;
  medianFirstResponseHours: number | null;
};

export type PropertyRequestStallSegment = {
  key: string;
  label: string;
  requestsPublished: number;
  requestsWithoutResponses: number;
  zeroResponseRate: number | null;
  totalResponsesSent: number;
};

export type PropertyRequestRecentOutcomeSnapshot = {
  windowDays: number;
  requestsPublished: number;
  requestsWithResponses: number;
  requestsWithoutResponses: number;
  totalResponsesSent: number;
  responseRate: number | null;
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
    request.title,
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

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
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
  const publishedRequests = requests.filter((request) => request.publishedAt !== null);
  const firstResponseHours = publishedRequests
    .map((request) => summary.get(request.id)?.hoursToFirstResponse ?? null)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const requestsWithResponses = publishedRequests.filter(
    (request) => (summary.get(request.id)?.responseCount ?? 0) > 0
  ).length;

  return {
    requestsCreated: requests.length,
    requestsPublished: publishedRequests.length,
    openRequests: requests.filter((request) => request.status === "open").length,
    matchedRequests: requests.filter((request) => request.status === "matched").length,
    closedRequests: requests.filter((request) => request.status === "closed").length,
    expiredRequests: requests.filter((request) => request.status === "expired").length,
    removedRequests: requests.filter((request) => request.status === "removed").length,
    requestsWithResponses,
    requestsWithoutResponses: publishedRequests.length - requestsWithResponses,
    totalResponsesSent: responses.length,
    responseRate: calculateRate(requestsWithResponses, publishedRequests.length),
    averageFirstResponseHours: average(firstResponseHours),
    medianFirstResponseHours: median(firstResponseHours),
  };
}

function buildBreakdownRows(
  requests: PropertyRequest[],
  responses: PropertyRequestAnalyticsResponseRow[],
  getKey: (request: PropertyRequest) => string,
  getLabel: (request: PropertyRequest) => string
): PropertyRequestTelemetryBreakdownRow[] {
  const summary = buildPropertyRequestResponseSummaryMap(requests, responses);
  const responsesByRequestId = new Map<string, number>();
  for (const response of responses) {
    responsesByRequestId.set(
      response.request_id,
      (responsesByRequestId.get(response.request_id) ?? 0) + 1
    );
  }

  const grouped = new Map<
    string,
    {
      label: string;
      requests: PropertyRequest[];
    }
  >();

  for (const request of requests) {
    const key = getKey(request);
    const current = grouped.get(key) ?? { label: getLabel(request), requests: [] };
    current.requests.push(request);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([key, group]) => {
      const publishedRequests = group.requests.filter((request) => request.publishedAt !== null);
      const requestsWithResponses = publishedRequests.filter(
        (request) => (summary.get(request.id)?.responseCount ?? 0) > 0
      ).length;
      const firstResponseHours = publishedRequests
        .map((request) => summary.get(request.id)?.hoursToFirstResponse ?? null)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

      return {
        key,
        label: group.label,
        requestsCreated: group.requests.length,
        requestsPublished: publishedRequests.length,
        openRequests: group.requests.filter((request) => request.status === "open").length,
        matchedRequests: group.requests.filter((request) => request.status === "matched").length,
        closedRequests: group.requests.filter((request) => request.status === "closed").length,
        expiredRequests: group.requests.filter((request) => request.status === "expired").length,
        removedRequests: group.requests.filter((request) => request.status === "removed").length,
        requestsWithResponses,
        requestsWithoutResponses: publishedRequests.length - requestsWithResponses,
        totalResponsesSent: group.requests.reduce(
          (sum, request) => sum + (responsesByRequestId.get(request.id) ?? 0),
          0
        ),
        responseRate: calculateRate(requestsWithResponses, publishedRequests.length),
        averageFirstResponseHours: average(firstResponseHours),
        medianFirstResponseHours: median(firstResponseHours),
      };
    })
    .sort((left, right) => right.requestsPublished - left.requestsPublished || left.label.localeCompare(right.label));
}

export function buildPropertyRequestBreakdownByIntent(
  requests: PropertyRequest[],
  responses: PropertyRequestAnalyticsResponseRow[]
): PropertyRequestTelemetryBreakdownRow[] {
  const intentOrder: PropertyRequestIntent[] = ["rent", "buy", "shortlet"];
  const rows = buildBreakdownRows(
    requests,
    responses,
    (request) => request.intent,
    (request) => getPropertyRequestIntentLabel(request.intent)
  );

  return rows.sort(
    (left, right) =>
      intentOrder.indexOf(left.key as PropertyRequestIntent) -
        intentOrder.indexOf(right.key as PropertyRequestIntent) ||
      left.label.localeCompare(right.label)
  );
}

export function buildPropertyRequestBreakdownByMarket(
  requests: PropertyRequest[],
  responses: PropertyRequestAnalyticsResponseRow[]
): PropertyRequestTelemetryBreakdownRow[] {
  return buildBreakdownRows(
    requests,
    responses,
    (request) => request.marketCode,
    (request) => request.marketCode
  );
}

export function buildPropertyRequestStallSegments(
  requests: PropertyRequest[],
  responses: PropertyRequestAnalyticsResponseRow[]
): PropertyRequestStallSegment[] {
  const rows = buildBreakdownRows(
    requests,
    responses,
    (request) => `${request.marketCode}:${request.intent}`,
    (request) => `${request.marketCode} · ${getPropertyRequestIntentLabel(request.intent)}`
  );

  return rows
    .filter((row) => row.requestsPublished > 0)
    .map((row) => ({
      key: row.key,
      label: row.label,
      requestsPublished: row.requestsPublished,
      requestsWithoutResponses: row.requestsWithoutResponses,
      zeroResponseRate: calculateRate(row.requestsWithoutResponses, row.requestsPublished),
      totalResponsesSent: row.totalResponsesSent,
    }))
    .sort(
      (left, right) =>
        right.requestsWithoutResponses - left.requestsWithoutResponses ||
        (right.zeroResponseRate ?? 0) - (left.zeroResponseRate ?? 0) ||
        left.label.localeCompare(right.label)
    );
}

export function buildRecentPropertyRequestOutcomeSnapshot(
  requests: PropertyRequest[],
  responses: PropertyRequestAnalyticsResponseRow[],
  options: { windowDays?: number; now?: Date } = {}
): PropertyRequestRecentOutcomeSnapshot {
  const windowDays = options.windowDays ?? 14;
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const recentRequests = requests.filter((request) => {
    if (!request.publishedAt) return false;
    const publishedTs = Date.parse(request.publishedAt);
    return Number.isFinite(publishedTs) && publishedTs >= cutoff;
  });

  const summary = buildPropertyRequestResponseSummaryMap(recentRequests, responses);
  const firstResponseHours = recentRequests
    .map((request) => summary.get(request.id)?.hoursToFirstResponse ?? null)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const requestsWithResponses = recentRequests.filter(
    (request) => (summary.get(request.id)?.responseCount ?? 0) > 0
  ).length;
  const recentRequestIds = new Set(recentRequests.map((request) => request.id));
  const totalResponsesSent = responses.filter((response) => recentRequestIds.has(response.request_id)).length;

  return {
    windowDays,
    requestsPublished: recentRequests.length,
    requestsWithResponses,
    requestsWithoutResponses: recentRequests.length - requestsWithResponses,
    totalResponsesSent,
    responseRate: calculateRate(requestsWithResponses, recentRequests.length),
    averageFirstResponseHours: average(firstResponseHours),
    medianFirstResponseHours: median(firstResponseHours),
  };
}
