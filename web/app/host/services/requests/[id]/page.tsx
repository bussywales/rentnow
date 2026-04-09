import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  getMoveReadyCategoryLabel,
  getMoveReadyLeadStatusLabel,
  getMoveReadyRequestStatusLabel,
} from "@/lib/services/move-ready";
import { getProfile } from "@/lib/auth";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type RequestRow = {
  id: string;
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
  routing_status: string;
  response_note: string | null;
  responded_at: string | null;
  move_ready_service_providers?: {
    business_name: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
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

export default async function HostMoveReadyRequestDetailPage({ params, searchParams }: Props) {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return (
      <ErrorState
        title="Move & Ready Services unavailable"
        description="Services routing needs the secured database environment before request detail can load."
        retryHref="/host/services"
        retryLabel="Back to requests"
      />
    );
  }

  const profile = await getProfile();
  if (!profile?.id) {
    return (
      <ErrorState
        title="Sign in required"
        description="Sign in again to view property-prep request detail."
        retryHref="/auth/login"
        retryLabel="Open login"
      />
    );
  }
  const helpHref = profile.role === "agent" ? "/help/agent/services" : "/help/host/services";

  const { id } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const created = resolvedSearch.created === "1";

  const client = createServiceRoleClient();
  const { data: requestRow } = await client
    .from("move_ready_requests")
    .select(
      "id,category,market_code,city,area,status,matched_provider_count,context_notes,preferred_timing_text,created_at,properties(title)"
    )
    .eq("id", id)
    .eq("requester_user_id", profile.id)
    .maybeSingle<RequestRow>();

  if (!requestRow) {
    return (
      <ErrorState
        title="Request not found"
        description="This property-prep request is unavailable or no longer belongs to your account."
        retryHref="/host/services"
        retryLabel="Back to requests"
      />
    );
  }

  const { data: leadRows } = await client
    .from("move_ready_request_leads")
    .select(
      "id,routing_status,response_note,responded_at,move_ready_service_providers(business_name,contact_name,email,phone)"
    )
    .eq("request_id", requestRow.id)
    .order("created_at", { ascending: true });

  const leads = (leadRows ?? []) as LeadRow[];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {created ? (
        <Alert
          variant={requestRow.status === "matched" ? "success" : "warning"}
          title={
            requestRow.status === "matched" ? "Request sent to providers" : "Request queued for manual routing"
          }
          description={
            requestRow.status === "matched"
              ? "Vetted providers have been routed. Watch this page for responses."
              : "No provider matched the area and category immediately, so the request is sitting in the unmatched operator queue."
          }
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Move &amp; Ready Services
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {getMoveReadyCategoryLabel(requestRow.category)}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {[requestRow.area, requestRow.city, requestRow.market_code].filter(Boolean).join(", ")}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {requestRow.properties?.title?.trim() || "No linked property"} · Submitted {formatDateTime(requestRow.created_at)}
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Request context</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{requestRow.context_notes}</p>
        <p className="mt-3 text-sm text-slate-600">
          Preferred timing: {requestRow.preferred_timing_text || "Flexible"}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Provider responses</h2>
            <p className="text-sm text-slate-600">
              Only routed providers show here. Unmatched requests remain manual until an operator routes them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/host/services">
              <Button variant="secondary" size="sm">
                Back to requests
              </Button>
            </Link>
            <Link href={helpHref} className="inline-flex items-center text-sm font-semibold text-slate-700">
              Pilot guide
            </Link>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {lead.move_ready_service_providers?.business_name?.trim() || "Vetted provider"}
                  </p>
                  <p className="text-sm text-slate-600">
                    {lead.move_ready_service_providers?.contact_name?.trim() || "Operator-routed lead"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {getMoveReadyLeadStatusLabel(lead.routing_status)}
                </span>
              </div>
              {lead.response_note ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{lead.response_note}</p>
              ) : null}
              {(lead.routing_status === "accepted" || lead.response_note) && (
                <div className="mt-3 text-sm text-slate-600">
                  <p>{lead.move_ready_service_providers?.email || "No email shared yet"}</p>
                  {lead.move_ready_service_providers?.phone ? <p>{lead.move_ready_service_providers.phone}</p> : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Responded {formatDateTime(lead.responded_at)}
                  </p>
                </div>
              )}
            </div>
          ))}
          {leads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No provider responses yet. If this request is unmatched, the operator queue is the next
              real step.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
