import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import { moveReadyProviderLeadResponseSchema } from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type ProviderLeadRespondDeps = {
  hasServiceRoleEnv: () => boolean;
  createServiceRoleClient: typeof createServiceRoleClient;
  logProductAnalyticsEvent: typeof logProductAnalyticsEvent;
  now: () => Date;
};

const defaultDeps: ProviderLeadRespondDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  logProductAnalyticsEvent,
  now: () => new Date(),
};

type LeadRow = {
  id: string;
  request_id: string;
  provider_id: string;
  routing_status: string;
  response_note: string | null;
  move_ready_requests?: {
    requester_role: string | null;
    market_code: string | null;
    area: string | null;
    property_id: string | null;
    category: string | null;
    matched_provider_count: number | null;
  } | null;
};

async function loadLeadByToken(client: ServiceClient, token: string) {
  const { data } = await client
    .from("move_ready_request_leads")
    .select(
      "id,request_id,provider_id,routing_status,response_note,move_ready_requests(requester_role,market_code,area,property_id,category,matched_provider_count)"
    )
    .eq("response_token", token)
    .maybeSingle<LeadRow>();

  return data ?? null;
}

export async function postMoveReadyProviderLeadResponse(
  request: NextRequest,
  deps: ProviderLeadRespondDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Move & Ready Services is unavailable." }, { status: 503 });
  }

  const parsed = moveReadyProviderLeadResponseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const client = deps.createServiceRoleClient();
  const lead = await loadLeadByToken(client, parsed.data.token);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if (lead.routing_status === "accepted" || lead.routing_status === "declined") {
    return NextResponse.json({ error: "This lead already has a final response." }, { status: 409 });
  }

  const nowIso = deps.now().toISOString();
  const nextStatus = parsed.data.action === "accept" ? "accepted" : "declined";
  const responseNote = parsed.data.responseNote ?? null;

  const { error } = await client
    .from("move_ready_request_leads")
    .update(
      {
        routing_status: nextStatus,
        response_note: responseNote,
        responded_at: nowIso,
        opened_at: nowIso,
        updated_at: nowIso,
      } as never
    )
    .eq("id", lead.id);

  if (error) {
    return NextResponse.json({ error: "Unable to update the lead." }, { status: 500 });
  }

  const requestMeta = lead.move_ready_requests ?? null;
  await deps.logProductAnalyticsEvent({
    eventName: nextStatus === "accepted" ? "provider_lead_accepted" : "provider_lead_declined",
    supabase: client,
    userId: null,
    userRole: "provider",
    properties: {
      role: "provider",
      market: requestMeta?.market_code ?? undefined,
      area: requestMeta?.area ?? undefined,
      propertyId: requestMeta?.property_id ?? undefined,
      requesterRole: requestMeta?.requester_role ?? undefined,
      category: requestMeta?.category ?? undefined,
      matchedProviderCount: requestMeta?.matched_provider_count ?? undefined,
      providerId: lead.provider_id,
    },
  });

  if (responseNote) {
    await deps.logProductAnalyticsEvent({
      eventName: "provider_response_submitted",
      supabase: client,
      userId: null,
      userRole: "provider",
      properties: {
        role: "provider",
        market: requestMeta?.market_code ?? undefined,
        area: requestMeta?.area ?? undefined,
        propertyId: requestMeta?.property_id ?? undefined,
        requesterRole: requestMeta?.requester_role ?? undefined,
        category: requestMeta?.category ?? undefined,
        matchedProviderCount: requestMeta?.matched_provider_count ?? undefined,
        providerId: lead.provider_id,
      },
    });
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}

export async function POST(request: NextRequest) {
  return postMoveReadyProviderLeadResponse(request);
}
