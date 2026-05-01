import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import { moveReadyAdminRequestOutcomeSchema } from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type RequestStatusDeps = {
  hasServiceRoleEnv: () => boolean;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  logProductAnalyticsEvent: typeof logProductAnalyticsEvent;
  now: () => Date;
};

const defaultDeps: RequestStatusDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  requireRole,
  logProductAnalyticsEvent,
  now: () => new Date(),
};

type RequestRow = {
  id: string;
  requester_user_id: string;
  requester_role: string;
  property_id: string | null;
  market_code: string;
  area: string | null;
  category: string;
  matched_provider_count: number | null;
  status: string;
};

type LeadRow = {
  id: string;
  provider_id: string;
  routing_status: string;
};

async function loadRequest(client: ServiceClient, requestId: string) {
  const { data } = await client
    .from("move_ready_requests")
    .select("id,requester_user_id,requester_role,property_id,market_code,area,category,matched_provider_count,status")
    .eq("id", requestId)
    .maybeSingle<RequestRow>();
  return data ?? null;
}

async function loadLead(client: ServiceClient, requestId: string, providerId: string) {
  const { data } = await client
    .from("move_ready_request_leads")
    .select("id,provider_id,routing_status")
    .eq("request_id", requestId)
    .eq("provider_id", providerId)
    .maybeSingle<LeadRow>();
  return data ?? null;
}

export async function patchAdminMoveReadyRequestStatusResponse(
  request: NextRequest,
  requestId: string,
  deps: RequestStatusDeps = defaultDeps
) {
  const auth = await deps.requireRole({
    request,
    route: "/api/admin/services/requests/[id]/status",
    startTime: Date.now(),
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Services admin is unavailable." }, { status: 503 });
  }

  const parsed = moveReadyAdminRequestOutcomeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request status payload.", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const client = deps.createServiceRoleClient();
  const requestRow = await loadRequest(client, requestId);
  if (!requestRow) {
    return NextResponse.json({ error: "Service request not found." }, { status: 404 });
  }

  if (["awarded", "closed_no_match", "closed"].includes(requestRow.status)) {
    return NextResponse.json({ error: "This request already has a final outcome." }, { status: 409 });
  }

  const nowIso = deps.now().toISOString();

  if (parsed.data.action === "award") {
    const lead = await loadLead(client, requestRow.id, parsed.data.providerId);
    if (!lead) {
      return NextResponse.json({ error: "Provider has not been dispatched for this request." }, { status: 404 });
    }

    if (!["accepted", "needs_more_information", "awarded"].includes(lead.routing_status)) {
      return NextResponse.json({ error: "Only positive provider responses can be awarded." }, { status: 409 });
    }

    const { error: requestUpdateError } = await client
      .from("move_ready_requests")
      .update(
        {
          status: "awarded",
          awarded_provider_id: parsed.data.providerId,
          awarded_at: nowIso,
          awarded_by: auth.user.id,
          closed_at: null,
          closed_by: null,
          updated_at: nowIso,
        } as never
      )
      .eq("id", requestRow.id);

    if (requestUpdateError) {
      return NextResponse.json({ error: "Unable to award this request." }, { status: 500 });
    }

    await client
      .from("move_ready_request_leads")
      .update({ routing_status: "awarded", updated_at: nowIso } as never)
      .eq("request_id", requestRow.id)
      .eq("provider_id", parsed.data.providerId);

    await deps.logProductAnalyticsEvent({
      eventName: "property_prep_request_awarded",
      request,
      supabase: client,
      userId: requestRow.requester_user_id,
      userRole: requestRow.requester_role,
      properties: {
        role: requestRow.requester_role,
        market: requestRow.market_code,
        area: requestRow.area ?? undefined,
        propertyId: requestRow.property_id ?? undefined,
        requesterRole: requestRow.requester_role,
        category: requestRow.category,
        matchedProviderCount: requestRow.matched_provider_count ?? undefined,
        providerId: parsed.data.providerId,
        requestStatus: "awarded",
      },
    });

    return NextResponse.json({ ok: true, status: "awarded" });
  }

  const { error: closeError } = await client
    .from("move_ready_requests")
    .update(
      {
        status: "closed_no_match",
        awarded_provider_id: null,
        awarded_at: null,
        awarded_by: null,
        closed_at: nowIso,
        closed_by: auth.user.id,
        updated_at: nowIso,
      } as never
    )
    .eq("id", requestRow.id);

  if (closeError) {
    return NextResponse.json({ error: "Unable to close this request." }, { status: 500 });
  }

  await deps.logProductAnalyticsEvent({
    eventName: "property_prep_request_closed_no_match",
    request,
    supabase: client,
    userId: requestRow.requester_user_id,
    userRole: requestRow.requester_role,
    properties: {
      role: requestRow.requester_role,
      market: requestRow.market_code,
      area: requestRow.area ?? undefined,
      propertyId: requestRow.property_id ?? undefined,
      requesterRole: requestRow.requester_role,
      category: requestRow.category,
      matchedProviderCount: requestRow.matched_provider_count ?? undefined,
      requestStatus: "closed_no_match",
    },
  });

  return NextResponse.json({ ok: true, status: "closed_no_match" });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return patchAdminMoveReadyRequestStatusResponse(request, id);
}
