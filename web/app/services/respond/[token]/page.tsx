import { ErrorState } from "@/components/ui/ErrorState";
import { MoveReadyProviderResponseForm } from "@/components/services/MoveReadyProviderResponseForm";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getMoveReadyCategoryLabel, getMoveReadyLeadStatusLabel } from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

type LeadRow = {
  id: string;
  routing_status: string;
  response_note: string | null;
  opened_at: string | null;
  provider_id: string;
  move_ready_service_providers?: {
    business_name: string | null;
  } | null;
  move_ready_requests?: {
    category: string | null;
    market_code: string | null;
    city: string | null;
    area: string | null;
    preferred_timing_text: string | null;
    context_notes: string | null;
  } | null;
};

export default async function MoveReadyProviderResponsePage({ params }: Props) {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return (
      <ErrorState
        title="Lead response unavailable"
        description="The secure response flow is not configured right now."
        retryHref="/support"
        retryLabel="Contact support"
      />
    );
  }

  const { token } = await params;
  const client = createServiceRoleClient();
  const { data } = await client
    .from("move_ready_request_leads")
    .select(
      "id,provider_id,routing_status,response_note,opened_at,move_ready_service_providers(business_name),move_ready_requests(category,market_code,city,area,preferred_timing_text,context_notes)"
    )
    .eq("response_token", token)
    .maybeSingle<LeadRow>();

  if (!data) {
    return (
      <ErrorState
        title="Lead not found"
        description="This lead link is invalid or no longer available."
        retryHref="/support"
        retryLabel="Contact support"
      />
    );
  }

  if (!data.opened_at) {
    await client
      .from("move_ready_request_leads")
      .update({ opened_at: new Date().toISOString() } as never)
      .eq("id", data.id);
  }

  const request = data.move_ready_requests ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Move &amp; Ready Services
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Respond to routed lead</h1>
        <p className="mt-2 text-sm text-slate-600">
          {data.move_ready_service_providers?.business_name?.trim() || "Provider"} can respond to this
          property-prep lead without creating a dashboard account.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
            {getMoveReadyLeadStatusLabel(data.routing_status)}
          </span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-800">
            {getMoveReadyCategoryLabel(request?.category)}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Lead context</h2>
        <p className="mt-2 text-sm text-slate-600">
          {[request?.area, request?.city, request?.market_code].filter(Boolean).join(", ")}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Timing: {request?.preferred_timing_text || "Flexible"}
        </p>
        {request?.context_notes ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Request note</p>
            <p className="mt-2 whitespace-pre-wrap">{request.context_notes}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <MoveReadyProviderResponseForm
          token={token}
          currentStatus={data.routing_status}
          existingResponseNote={data.response_note}
        />
      </section>
    </div>
  );
}
