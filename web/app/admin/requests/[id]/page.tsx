import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminPropertyRequestModerationActions } from "@/components/admin/AdminPropertyRequestModerationActions";
import { PropertyRequestResponsesSection } from "@/components/requests/PropertyRequestResponsesSection";
import { PropertyRequestStatusBadge } from "@/components/requests/PropertyRequestStatusBadge";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  buildPropertyRequestResponseSummaryMap,
  type PropertyRequestAnalyticsResponseRow,
} from "@/lib/requests/property-requests-admin";
import {
  getPropertyRequestDisplayTitle,
  getPropertyRequestIntentLabel,
  getPropertyRequestLocationSummary,
  getPropertyRequestMoveTimelineLabel,
  getPropertyRequestPropertyTypeLabel,
  shouldShowPropertyRequestBathrooms,
  shouldShowPropertyRequestBedrooms,
  mapPropertyRequestRecord,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";
import { listVisiblePropertyRequestResponses } from "@/lib/requests/property-request-responses.server";

export const dynamic = "force-dynamic";

function formatMoney(value: number | null, currencyCode: string) {
  if (typeof value !== "number") return "Any";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toLocaleString()}`;
  }
}

function formatBudget(request: ReturnType<typeof mapPropertyRequestRecord>) {
  if (typeof request.budgetMin === "number" && typeof request.budgetMax === "number") {
    return `${formatMoney(request.budgetMin, request.currencyCode)} - ${formatMoney(request.budgetMax, request.currencyCode)}`;
  }
  if (typeof request.budgetMin === "number") return `From ${formatMoney(request.budgetMin, request.currencyCode)}`;
  if (typeof request.budgetMax === "number") return `Up to ${formatMoney(request.budgetMax, request.currencyCode)}`;
  return "Budget flexible";
}

function RequestFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

export default async function AdminPropertyRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasServerSupabaseEnv()) {
    return <div className="p-6 text-sm text-slate-600">Supabase is not configured.</div>;
  }

  const { id } = await params;
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect(`/auth/required?redirect=/admin/requests/${id}&reason=auth`);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const { data: requestRow } = await client
    .from("property_requests")
    .select(
      "id,owner_user_id,owner_role,intent,market_code,currency_code,title,city,area,location_text,budget_min,budget_max,property_type,bedrooms,bathrooms,furnished,move_timeline,shortlet_duration,notes,status,published_at,expires_at,created_at,updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!requestRow) {
    notFound();
  }

  const request = mapPropertyRequestRecord(requestRow as PropertyRequestRecord);
  const [ownerProfileResult, responseRowsResult, responses] = await Promise.all([
    client.from("profiles").select("id, full_name, role").eq("id", request.ownerUserId).maybeSingle(),
    client.from("property_request_responses").select("id, request_id, responder_user_id, created_at").eq("request_id", request.id),
    listVisiblePropertyRequestResponses({
      supabase,
      role: "admin",
      userId: user.id,
      requestId: request.id,
    }),
  ]);

  const ownerProfile = ownerProfileResult.data;
  const responseSummary = buildPropertyRequestResponseSummaryMap(
    [request],
    (responseRowsResult.data ?? []) as PropertyRequestAnalyticsResponseRow[]
  ).get(request.id);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8" data-testid="admin-request-detail-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <PropertyRequestStatusBadge status={request.status} />
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{getPropertyRequestIntentLabel(request.intent)}</p>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{request.marketCode}</p>
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{getPropertyRequestDisplayTitle(request)}</h1>
            <p className="mt-1 text-sm text-slate-500">{getPropertyRequestLocationSummary(request)}</p>
            <p className="mt-2 text-sm text-slate-600">
              Admin inspection view for request moderation, expiry management, and response oversight.
            </p>
          </div>
        </div>
        <Link href="/admin/requests" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300">
          Back to requests
        </Link>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <RequestFact label="Budget" value={formatBudget(request)} />
          <RequestFact label="Property type" value={getPropertyRequestPropertyTypeLabel(request.propertyType)} />
          {shouldShowPropertyRequestBedrooms(request.propertyType) ? (
            <RequestFact label="Bedrooms" value={request.bedrooms?.toString() ?? "Any"} />
          ) : null}
          {shouldShowPropertyRequestBathrooms(request.propertyType) ? (
            <RequestFact label="Bathrooms" value={request.bathrooms?.toString() ?? "Any"} />
          ) : null}
          <RequestFact label="Move timeline" value={getPropertyRequestMoveTimelineLabel(request.moveTimeline)} />
          <RequestFact label="Furnished" value={request.furnished === null ? "No preference" : request.furnished ? "Furnished" : "Unfurnished"} />
          <RequestFact label="Published" value={request.publishedAt ? new Date(request.publishedAt).toLocaleString() : "Not published"} />
          <RequestFact label="Expires" value={request.expiresAt ? new Date(request.expiresAt).toLocaleString() : "Not scheduled"} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <RequestFact label="Owner" value={ownerProfile?.full_name?.trim() || "Seeker"} />
          <RequestFact label="Owner role" value={(ownerProfile?.role ?? request.ownerRole).toString()} />
          <RequestFact label="Responses" value={`${responseSummary?.responseCount ?? 0}`} />
          <RequestFact label="Unique responders" value={`${responseSummary?.responderCount ?? 0}`} />
        </div>

        {request.shortletDuration ? (
          <div className="mt-4">
            <RequestFact label="Shortlet duration" value={request.shortletDuration} />
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{request.notes ?? "No extra requirements added yet."}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Moderation</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Request controls</h2>
        <p className="mt-2 text-sm text-slate-600">
          Use explicit actions to close stale demand, force expiry, or remove a request from circulation.
        </p>
        <div className="mt-4">
          <AdminPropertyRequestModerationActions requestId={request.id} status={request.status} />
        </div>
      </section>

      <PropertyRequestResponsesSection responses={responses} viewer="admin" />
    </div>
  );
}
