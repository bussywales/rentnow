import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import {
  buildMoveReadyLeadToken,
  filterEligibleMoveReadyProviders,
  sendMoveReadyLeadEmail,
  type MoveReadyProviderRecord,
} from "@/lib/services/move-ready.server";
import type { MoveReadyServiceCategory } from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

const schema = z.object({
  providerId: z.string().uuid(),
});

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type DispatchDeps = {
  hasServiceRoleEnv: () => boolean;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  sendMoveReadyLeadEmail: typeof sendMoveReadyLeadEmail;
  logProductAnalyticsEvent: typeof logProductAnalyticsEvent;
  now: () => Date;
};

const defaultDeps: DispatchDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  requireRole,
  sendMoveReadyLeadEmail,
  logProductAnalyticsEvent,
  now: () => new Date(),
};

type RequestRow = {
  id: string;
  requester_user_id: string;
  requester_role: string;
  property_id: string | null;
  category: string;
  market_code: string;
  city: string | null;
  area: string | null;
  context_notes: string;
  preferred_timing_text: string | null;
  matched_provider_count: number | null;
  status: string;
  properties?: { title: string | null } | null;
};

async function loadRequest(client: ServiceClient, requestId: string) {
  const { data } = await client
    .from("move_ready_requests")
    .select(
      "id,requester_user_id,requester_role,property_id,category,market_code,city,area,context_notes,preferred_timing_text,matched_provider_count,status,properties(title)"
    )
    .eq("id", requestId)
    .maybeSingle<RequestRow>();
  return data ?? null;
}

async function loadProvider(client: ServiceClient, providerId: string) {
  const { data } = await client
    .from("move_ready_service_providers")
    .select(
      "id,business_name,contact_name,email,phone,verification_state,provider_status,move_ready_provider_categories(category),move_ready_provider_areas(market_code,city,area)"
    )
    .eq("id", providerId)
    .maybeSingle<MoveReadyProviderRecord>();
  return data ?? null;
}

export async function postAdminMoveReadyRequestDispatchResponse(
  request: NextRequest,
  requestId: string,
  deps: DispatchDeps = defaultDeps
) {
  const auth = await deps.requireRole({
    request,
    route: "/api/admin/services/requests/[id]/dispatch",
    startTime: Date.now(),
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Services admin is unavailable." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid dispatch payload.", issues: parsed.error.flatten() },
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

  const provider = await loadProvider(client, parsed.data.providerId);
  if (!provider) {
    return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  }

  const eligible = filterEligibleMoveReadyProviders([provider], {
    category: requestRow.category as MoveReadyServiceCategory,
    marketCode: requestRow.market_code,
    city: requestRow.city,
    area: requestRow.area,
  });
  if (eligible.length === 0) {
    return NextResponse.json({ error: "Provider does not match this request." }, { status: 409 });
  }

  const nowIso = deps.now().toISOString();
  const token = buildMoveReadyLeadToken();
  const { error: leadError } = await client.from("move_ready_request_leads").insert(
    {
      request_id: requestRow.id,
      provider_id: provider.id,
      response_token: token,
      routing_status: "pending_delivery",
      created_at: nowIso,
      updated_at: nowIso,
    } as never
  );

  if (leadError) {
    return NextResponse.json(
      { error: "Lead already exists for this provider or could not be created." },
      { status: 409 }
    );
  }

  const delivery = await deps.sendMoveReadyLeadEmail({
    provider: {
      businessName: provider.business_name,
      email: provider.email,
    },
    request: {
      category: requestRow.category,
      marketCode: requestRow.market_code,
      city: requestRow.city,
      area: requestRow.area,
      propertyTitle: requestRow.properties?.title ?? null,
      preferredTimingText: requestRow.preferred_timing_text,
      contextNotes: requestRow.context_notes,
      requesterRole: requestRow.requester_role,
    },
    responseToken: token,
  });

  await client
    .from("move_ready_request_leads")
    .update(
      {
        routing_status: delivery.ok ? "sent" : "delivery_failed",
        last_error: delivery.ok ? null : delivery.error,
        updated_at: nowIso,
      } as never
    )
    .eq("request_id", requestRow.id)
    .eq("provider_id", provider.id);

  const nextMatchedCount = (requestRow.matched_provider_count ?? 0) + 1;
  await client
    .from("move_ready_requests")
    .update(
      {
        status: "matched",
        matched_provider_count: nextMatchedCount,
        updated_at: nowIso,
      } as never
    )
    .eq("id", requestRow.id);

  if (delivery.ok) {
    await deps.logProductAnalyticsEvent({
      eventName: "provider_lead_sent",
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
        matchedProviderCount: nextMatchedCount,
        providerId: provider.id,
      },
    });

    await deps.logProductAnalyticsEvent({
      eventName: "property_prep_provider_dispatched",
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
        matchedProviderCount: nextMatchedCount,
        providerId: provider.id,
        requestStatus: "dispatched",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    status: delivery.ok ? "sent" : "delivery_failed",
    matchedProviderCount: nextMatchedCount,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return postAdminMoveReadyRequestDispatchResponse(request, id);
}
