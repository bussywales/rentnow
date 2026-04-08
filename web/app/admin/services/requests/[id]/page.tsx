import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  filterEligibleMoveReadyProviders,
  type MoveReadyProviderRecord,
} from "@/lib/services/move-ready.server";
import {
  formatMoveReadyAreaLine,
  getMoveReadyCategoryLabel,
  getMoveReadyLeadStatusLabel,
  getMoveReadyRequestStatusLabel,
  type MoveReadyServiceCategory,
} from "@/lib/services/move-ready";
import { AdminMoveReadyDispatchForm } from "@/components/services/AdminMoveReadyDispatchForm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type RequestRow = {
  id: string;
  requester_role: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  contact_preference: string | null;
  category: string;
  market_code: string;
  city: string | null;
  area: string | null;
  status: string;
  matched_provider_count: number;
  context_notes: string;
  preferred_timing_text: string | null;
  created_at: string;
  properties?: { title: string | null } | null;
};

type LeadRow = {
  id: string;
  provider_id: string;
  routing_status: string;
  response_note: string | null;
  last_error: string | null;
  responded_at: string | null;
  move_ready_service_providers?: {
    business_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminMoveReadyRequestDetailPage({ params }: Props) {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return <div className="p-6 text-sm text-slate-600">Services admin is unavailable.</div>;
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/services/requests&reason=auth");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");

  const { id } = await params;
  const client = createServiceRoleClient();
  const { data: requestRow } = await client
    .from("move_ready_requests")
    .select(
      "id,requester_role,requester_name,requester_email,requester_phone,contact_preference,category,market_code,city,area,status,matched_provider_count,context_notes,preferred_timing_text,created_at,properties(title)"
    )
    .eq("id", id)
    .maybeSingle<RequestRow>();

  if (!requestRow) {
    return (
      <ErrorState
        title="Request not found"
        description="This property-prep request no longer exists."
        retryHref="/admin/services/requests"
        retryLabel="Back to request queue"
      />
    );
  }

  const [{ data: leadRows }, { data: providers }] = await Promise.all([
    client
      .from("move_ready_request_leads")
      .select(
        "id,provider_id,routing_status,response_note,last_error,responded_at,move_ready_service_providers(business_name,email,phone)"
      )
      .eq("request_id", requestRow.id)
      .order("created_at", { ascending: true }),
    client
      .from("move_ready_service_providers")
      .select(
        "id,business_name,contact_name,email,phone,verification_state,provider_status,move_ready_provider_categories(category),move_ready_provider_areas(market_code,city,area)"
      )
      .order("created_at", { ascending: true }),
  ]);

  const leads = (leadRows ?? []) as LeadRow[];
  const eligibleProviders = filterEligibleMoveReadyProviders(
    ((providers ?? []) as MoveReadyProviderRecord[]).filter(
      (provider) => !leads.some((lead) => lead.provider_id === provider.id)
    ),
    {
      category: requestRow.category as MoveReadyServiceCategory,
      marketCode: requestRow.market_code,
      city: requestRow.city,
      area: requestRow.area,
    }
  ).map((provider) => ({
    id: provider.id,
    businessName: provider.business_name,
    coverageSummary:
      provider.move_ready_provider_areas?.map((area) => formatMoveReadyAreaLine({
        marketCode: area.market_code,
        city: area.city,
        area: area.area,
      })).join(" · ") || provider.email,
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {getMoveReadyCategoryLabel(requestRow.category)}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {[requestRow.area, requestRow.city, requestRow.market_code].filter(Boolean).join(", ")}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {requestRow.properties?.title?.trim() || "No linked property"} · {formatDateTime(requestRow.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
              {getMoveReadyRequestStatusLabel(requestRow.status)}
            </span>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-800">
              Routed {requestRow.matched_provider_count}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Requester context</h2>
            <p className="mt-2 text-sm text-slate-700">
              {requestRow.requester_name || requestRow.requester_role} · {requestRow.requester_email || "No email"} ·{" "}
              {requestRow.requester_phone || "No phone"} · Prefers {requestRow.contact_preference || "unspecified"}
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Request note</p>
              <p className="mt-2 whitespace-pre-wrap">{requestRow.context_notes}</p>
              <p className="mt-3 text-slate-600">
                Timing: {requestRow.preferred_timing_text || "Flexible"}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Lead status</h2>
            <div className="mt-4 space-y-4">
              {leads.map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {lead.move_ready_service_providers?.business_name?.trim() || "Vetted provider"}
                      </p>
                      <p className="text-sm text-slate-600">
                        {lead.move_ready_service_providers?.email || "No email"}{" "}
                        {lead.move_ready_service_providers?.phone ? `· ${lead.move_ready_service_providers.phone}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {getMoveReadyLeadStatusLabel(lead.routing_status)}
                    </span>
                  </div>
                  {lead.response_note ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{lead.response_note}</p>
                  ) : null}
                  {lead.last_error ? (
                    <p className="mt-3 text-xs text-rose-700">Delivery issue: {lead.last_error}</p>
                  ) : null}
                  {lead.responded_at ? (
                    <p className="mt-2 text-xs text-slate-500">Responded {formatDateTime(lead.responded_at)}</p>
                  ) : null}
                </div>
              ))}
              {leads.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  No leads have been sent yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Manual routing</h2>
          <p className="mt-2 text-sm text-slate-600">
            Only active, approved providers with the right category and area are eligible here.
          </p>
          <div className="mt-4">
            <AdminMoveReadyDispatchForm requestId={requestRow.id} providers={eligibleProviders} />
          </div>
        </section>
      </section>
    </div>
  );
}
