import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  buildPropertyRequestAdminAnalytics,
  buildPropertyRequestBreakdownByIntent,
  buildPropertyRequestBreakdownByMarket,
  buildRecentPropertyRequestOutcomeSnapshot,
  buildPropertyRequestResponseSummaryMap,
  buildPropertyRequestStallSegments,
  matchesAdminPropertyRequestListFilters,
  parseAdminPropertyRequestListFilters,
  type PropertyRequestAnalyticsResponseRow,
} from "@/lib/requests/property-requests-admin";
import {
  getPropertyRequestDisplayTitle,
  getPropertyRequestIntentLabel,
  getPropertyRequestLocationSummary,
  getPropertyRequestPropertyTypeLabel,
  getPropertyRequestStatusLabel,
  mapPropertyRequestRecord,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatHours(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)}h`;
}

function formatRate(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

export default async function AdminPropertyRequestsPage({ searchParams }: Props) {
  if (!hasServerSupabaseEnv()) {
    return <div className="p-6 text-sm text-slate-600">Supabase is not configured.</div>;
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/requests&reason=auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const resolvedParams = searchParams ? await searchParams : {};
  const filters = parseAdminPropertyRequestListFilters(resolvedParams);

  const { data: requestRows } = await client
    .from("property_requests")
    .select(
      "id,owner_user_id,owner_role,intent,market_code,currency_code,title,city,area,location_text,budget_min,budget_max,property_type,bedrooms,bathrooms,furnished,move_timeline,shortlet_duration,notes,status,published_at,expires_at,created_at,updated_at"
    )
    .order("created_at", { ascending: false });

  const requests = ((requestRows ?? []) as PropertyRequestRecord[]).map(mapPropertyRequestRecord);
  const requestIds = requests.map((request) => request.id);
  const ownerIds = Array.from(new Set(requests.map((request) => request.ownerUserId)));

  const [responseRowsResult, ownerProfilesResult] = await Promise.all([
    requestIds.length
      ? client
          .from("property_request_responses")
          .select("id, request_id, responder_user_id, created_at")
          .in("request_id", requestIds)
      : Promise.resolve({ data: [] as PropertyRequestAnalyticsResponseRow[] }),
    ownerIds.length
      ? client.from("profiles").select("id, full_name, role").in("id", ownerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; role: string | null }> }),
  ]);

  const responseRows = (responseRowsResult.data ?? []) as PropertyRequestAnalyticsResponseRow[];
  const responseSummary = buildPropertyRequestResponseSummaryMap(requests, responseRows);
  const analytics = buildPropertyRequestAdminAnalytics(requests, responseRows);
  const recentOutcome = buildRecentPropertyRequestOutcomeSnapshot(requests, responseRows, {
    windowDays: 14,
  });
  const byIntent = buildPropertyRequestBreakdownByIntent(requests, responseRows);
  const byMarket = buildPropertyRequestBreakdownByMarket(requests, responseRows);
  const stallSegments = buildPropertyRequestStallSegments(requests, responseRows).slice(0, 6);
  const ownerMap = new Map(
    ((ownerProfilesResult.data ?? []) as Array<{ id: string; full_name: string | null; role: string | null }>).map((row) => [
      row.id,
      {
        name: row.full_name?.trim() || "Seeker",
        role: row.role,
      },
    ])
  );

  const visibleRequests = requests.filter((request) => matchesAdminPropertyRequestListFilters(request, filters));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8" data-testid="admin-requests-page">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Property requests</h1>
        <p className="text-sm text-slate-600">
          Review demand, inspect responder activity, and explicitly close, expire, or remove requests when needed.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="admin-requests-analytics">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Created</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.requestsCreated}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Published</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.requestsPublished}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Open</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.openRequests}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Matched</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.matchedRequests}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Closed</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.closedRequests}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Expired</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.expiredRequests}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Removed</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.removedRequests}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">With responses</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.requestsWithResponses}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Zero-response</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.requestsWithoutResponses}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Responses sent</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.totalResponsesSent}</p></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
            <p className="text-xs uppercase tracking-wide text-slate-500">Response rate</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatRate(analytics.responseRate)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
            <p className="text-xs uppercase tracking-wide text-slate-500">Average first response</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatHours(analytics.averageFirstResponseHours)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
            <p className="text-xs uppercase tracking-wide text-slate-500">Median first response</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatHours(analytics.medianFirstResponseHours)}</p>
          </div>
        </div>
        <div
          className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-sm text-slate-700"
          data-testid="admin-requests-recent-outcomes"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Recent 14-day outcome</p>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <p>Published: <span className="font-semibold text-slate-900">{recentOutcome.requestsPublished}</span></p>
            <p>With response: <span className="font-semibold text-slate-900">{recentOutcome.requestsWithResponses}</span></p>
            <p>Response rate: <span className="font-semibold text-slate-900">{formatRate(recentOutcome.responseRate)}</span></p>
            <p>Median first response: <span className="font-semibold text-slate-900">{formatHours(recentOutcome.medianFirstResponseHours)}</span></p>
          </div>
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200" data-testid="admin-requests-by-intent">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">By intent</h2>
              <p className="text-xs text-slate-500">Created, published, and response traction by demand type.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Intent</th>
                    <th className="px-4 py-2">Created</th>
                    <th className="px-4 py-2">Published</th>
                    <th className="px-4 py-2">With response</th>
                    <th className="px-4 py-2">Zero-response</th>
                    <th className="px-4 py-2">Response rate</th>
                    <th className="px-4 py-2">Avg first response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byIntent.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-2 font-medium text-slate-900">{row.label}</td>
                      <td className="px-4 py-2">{row.requestsCreated}</td>
                      <td className="px-4 py-2">{row.requestsPublished}</td>
                      <td className="px-4 py-2">{row.requestsWithResponses}</td>
                      <td className="px-4 py-2">{row.requestsWithoutResponses}</td>
                      <td className="px-4 py-2">{formatRate(row.responseRate)}</td>
                      <td className="px-4 py-2">{formatHours(row.averageFirstResponseHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200" data-testid="admin-requests-by-market">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">By market</h2>
              <p className="text-xs text-slate-500">Where demand is landing and where responses are actually happening.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Market</th>
                    <th className="px-4 py-2">Created</th>
                    <th className="px-4 py-2">Published</th>
                    <th className="px-4 py-2">With response</th>
                    <th className="px-4 py-2">Zero-response</th>
                    <th className="px-4 py-2">Responses</th>
                    <th className="px-4 py-2">Median first response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byMarket.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-2 font-medium text-slate-900">{row.label}</td>
                      <td className="px-4 py-2">{row.requestsCreated}</td>
                      <td className="px-4 py-2">{row.requestsPublished}</td>
                      <td className="px-4 py-2">{row.requestsWithResponses}</td>
                      <td className="px-4 py-2">{row.requestsWithoutResponses}</td>
                      <td className="px-4 py-2">{row.totalResponsesSent}</td>
                      <td className="px-4 py-2">{formatHours(row.medianFirstResponseHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <section className="mt-5 rounded-xl border border-slate-200" data-testid="admin-requests-stall-segments">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Stall segments</h2>
            <p className="text-xs text-slate-500">Published request segments currently stalling with zero responses.</p>
          </div>
          {stallSegments.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-600">No published request segments are currently stalling.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Segment</th>
                    <th className="px-4 py-2">Published</th>
                    <th className="px-4 py-2">Zero-response</th>
                    <th className="px-4 py-2">Zero-response rate</th>
                    <th className="px-4 py-2">Responses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stallSegments.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-2 font-medium text-slate-900">{row.label}</td>
                      <td className="px-4 py-2">{row.requestsPublished}</td>
                      <td className="px-4 py-2">{row.requestsWithoutResponses}</td>
                      <td className="px-4 py-2">{formatRate(row.zeroResponseRate)}</td>
                      <td className="px-4 py-2">{row.totalResponsesSent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs text-slate-600">
          Search
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Search id, location, notes, or intent"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-xs text-slate-600">
          Status
          <select
            name="status"
            defaultValue={filters.status}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="matched">Matched</option>
            <option value="closed">Closed</option>
            <option value="expired">Expired</option>
            <option value="removed">Removed</option>
          </select>
        </label>
        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Apply</button>
        <Link href="/admin/requests" className="text-sm font-semibold text-slate-600">Clear</Link>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          Showing {visibleRequests.length} of {requests.length} request{requests.length === 1 ? "" : "s"}
        </div>
        {visibleRequests.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600">No property requests match the current filter set.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responses</th>
                  <th className="px-4 py-3">Published</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRequests.map((request) => {
                  const summary = responseSummary.get(request.id);
                  const owner = ownerMap.get(request.ownerUserId);
                  return (
                    <tr key={request.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-900">{getPropertyRequestDisplayTitle(request)}</div>
                        <div className="mt-1 text-xs text-slate-500">{getPropertyRequestLocationSummary(request)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {getPropertyRequestIntentLabel(request.intent)} · {request.marketCode} · {getPropertyRequestPropertyTypeLabel(request.propertyType)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{request.id}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-700">
                        <div className="font-medium text-slate-900">{owner?.name ?? "Seeker"}</div>
                        <div className="text-xs text-slate-500">{owner?.role ?? request.ownerRole}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {getPropertyRequestStatusLabel(request.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-700">
                        <div>{summary?.responseCount ?? 0} responses</div>
                        <div className="text-xs text-slate-500">{summary?.responderCount ?? 0} responders</div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-700">{formatDate(request.publishedAt)}</td>
                      <td className="px-4 py-3 align-top text-sm text-slate-700">{formatDate(request.expiresAt)}</td>
                      <td className="px-4 py-3 align-top">
                        <Link href={`/admin/requests/${request.id}`} className="text-sm font-semibold text-slate-700 hover:underline">
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
