import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/authz";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { logFailure } from "@/lib/observability";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import {
  assessMoveReadyRoutingReadiness,
  filterEligibleMoveReadyProviders,
  buildMoveReadyLeadToken,
  sendMoveReadyLeadEmail,
  type MoveReadyProviderRecord,
} from "@/lib/services/move-ready.server";
import {
  moveReadyRequestCreateSchema,
  type MoveReadyServiceCategory,
} from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

const routeLabel = "/api/services/requests";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type CreateRequestDeps = {
  hasServiceRoleEnv: () => boolean;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  readActingAsFromRequest: typeof readActingAsFromRequest;
  hasActiveDelegation: typeof hasActiveDelegation;
  sendMoveReadyLeadEmail: typeof sendMoveReadyLeadEmail;
  logProductAnalyticsEvent: typeof logProductAnalyticsEvent;
  now: () => Date;
};

const defaultDeps: CreateRequestDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  requireRole,
  readActingAsFromRequest,
  hasActiveDelegation,
  sendMoveReadyLeadEmail,
  logProductAnalyticsEvent,
  now: () => new Date(),
};

type PropertyRow = {
  id: string;
  owner_id: string;
  title: string | null;
  city: string | null;
  location_label: string | null;
  country_code: string | null;
};

type ProfileRow = {
  full_name: string | null;
  phone: string | null;
  preferred_contact: string | null;
};

type RequestRow = {
  id: string;
};

function normalizeContactPreference(value: string | null | undefined) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "phone" || normalized === "email" ? normalized : null;
}

async function loadOwnedProperty(client: ServiceClient, propertyId: string, ownerId: string) {
  const { data } = await client
    .from("properties")
    .select("id, owner_id, title, city, location_label, country_code")
    .eq("id", propertyId)
    .eq("owner_id", ownerId)
    .maybeSingle<PropertyRow>();

  return data ?? null;
}

async function loadHostProfile(client: ServiceClient, userId: string) {
  const { data } = await client
    .from("profiles")
    .select("full_name, phone, preferred_contact")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  return data ?? null;
}

async function loadApprovedProviders(client: ServiceClient) {
  const { data } = await client
    .from("move_ready_service_providers")
    .select(
      "id,business_name,contact_name,email,phone,verification_state,provider_status,move_ready_provider_categories(category),move_ready_provider_areas(market_code,city,area)"
    )
    .order("created_at", { ascending: true });

  return ((data ?? []) as MoveReadyProviderRecord[]) ?? [];
}

async function insertLead(
  client: ServiceClient,
  input: {
    requestId: string;
    providerId: string;
    responseToken: string;
    nowIso: string;
  }
) {
  const { data, error } = await client
    .from("move_ready_request_leads")
    .insert(
      {
        request_id: input.requestId,
        provider_id: input.providerId,
        response_token: input.responseToken,
        routing_status: "pending_delivery",
        created_at: input.nowIso,
        updated_at: input.nowIso,
      } as never
    )
    .select("id")
    .maybeSingle();

  return { data, error };
}

export async function postMoveReadyServiceRequestResponse(
  request: NextRequest,
  deps: CreateRequestDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Move & Ready Services is unavailable." }, { status: 503 });
  }

  const parsed = moveReadyRequestCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const payload = parsed.data;
  const client = deps.createServiceRoleClient();
  const nowIso = deps.now().toISOString();
  let propertyOwnerId = auth.user.id;

  if (auth.role === "agent") {
    const actingAs = deps.readActingAsFromRequest(request);
    if (actingAs && actingAs !== auth.user.id) {
      const allowed = await deps.hasActiveDelegation(client, auth.user.id, actingAs);
      if (allowed) {
        propertyOwnerId = actingAs;
      }
    }
  }

  let property: PropertyRow | null = null;
  if (payload.propertyId) {
    property = await loadOwnedProperty(client, payload.propertyId, propertyOwnerId);
    if (!property) {
      return NextResponse.json({ error: "Property not found for this account." }, { status: 404 });
    }
  }

  const profile = await loadHostProfile(client, auth.user.id);
  const contactPreference =
    payload.contactPreference ?? normalizeContactPreference(profile?.preferred_contact) ?? "email";
  const city = payload.city ?? property?.city ?? null;
  const area = payload.area ?? property?.location_label ?? null;
  const marketCode = payload.marketCode || property?.country_code || "NG";

  const { data: requestRow, error: requestError } = await client
    .from("move_ready_requests")
    .insert(
      {
        requester_user_id: auth.user.id,
        requester_role: auth.role,
        requester_name: profile?.full_name ?? null,
        requester_email: auth.user.email ?? null,
        requester_phone: profile?.phone ?? null,
        contact_preference: contactPreference,
        property_id: property?.id ?? null,
        category: payload.category,
        entrypoint_source: payload.entrypointSource,
        market_code: marketCode,
        city,
        area,
        context_notes: payload.contextNotes,
        preferred_timing_text: payload.preferredTimingText ?? null,
        status: "submitted",
        matched_provider_count: 0,
        created_at: nowIso,
        updated_at: nowIso,
      } as never
    )
    .select("id")
    .maybeSingle<RequestRow>();

  if (requestError || !requestRow?.id) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: requestError?.message ?? "move_ready_request_insert_failed",
    });
    return NextResponse.json({ error: "Unable to create the request." }, { status: 500 });
  }

  const providers = await loadApprovedProviders(client);
  const readiness = assessMoveReadyRoutingReadiness(providers, {
    category: payload.category as MoveReadyServiceCategory,
    marketCode,
    city,
    area,
  });
  const matchedProviders = filterEligibleMoveReadyProviders(providers, {
    category: payload.category as MoveReadyServiceCategory,
    marketCode,
    city,
    area,
  });

  let sentCount = 0;
  for (const provider of matchedProviders) {
    const token = buildMoveReadyLeadToken();
    const leadInsert = await insertLead(client, {
      requestId: requestRow.id,
      providerId: provider.id,
      responseToken: token,
      nowIso,
    });

    if (leadInsert.error) {
      continue;
    }

    const delivery = await deps.sendMoveReadyLeadEmail({
      provider: {
        businessName: provider.business_name,
        email: provider.email,
      },
      request: {
        category: payload.category,
        marketCode,
        city,
        area,
        propertyTitle: property?.title ?? null,
        preferredTimingText: payload.preferredTimingText ?? null,
        contextNotes: payload.contextNotes,
        requesterRole: auth.role,
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

    if (delivery.ok) {
      sentCount += 1;
      await deps.logProductAnalyticsEvent({
        eventName: "provider_lead_sent",
        request,
        supabase: client,
        userId: auth.user.id,
        userRole: auth.role,
        properties: {
          role: auth.role,
          market: marketCode,
          area: area ?? undefined,
          propertyId: property?.id ?? undefined,
          requesterRole: auth.role,
          category: payload.category,
          entrypointSource: payload.entrypointSource,
          matchedProviderCount: matchedProviders.length,
          providerId: provider.id,
        },
      });
      await deps.logProductAnalyticsEvent({
        eventName: "property_prep_provider_dispatched",
        request,
        supabase: client,
        userId: auth.user.id,
        userRole: auth.role,
        properties: {
          role: auth.role,
          market: marketCode,
          area: area ?? undefined,
          propertyId: property?.id ?? undefined,
          requesterRole: auth.role,
          category: payload.category,
          entrypointSource: payload.entrypointSource,
          matchedProviderCount: matchedProviders.length,
          providerId: provider.id,
          requestStatus: "dispatched",
        },
      });
    }
  }

  const requestStatus = matchedProviders.length > 0 ? "matched" : "unmatched";
  await client
    .from("move_ready_requests")
    .update(
      {
        status: requestStatus,
        matched_provider_count: matchedProviders.length,
        updated_at: nowIso,
      } as never
    )
    .eq("id", requestRow.id);

  await deps.logProductAnalyticsEvent({
    eventName: "service_request_submitted",
    request,
    supabase: client,
    userId: auth.user.id,
    userRole: auth.role,
    properties: {
      role: auth.role,
      market: marketCode,
      area: area ?? undefined,
      propertyId: property?.id ?? undefined,
      requesterRole: auth.role,
      category: payload.category,
      entrypointSource: payload.entrypointSource,
      matchedProviderCount: matchedProviders.length,
    },
  });

  await deps.logProductAnalyticsEvent({
    eventName: matchedProviders.length > 0 ? "service_request_matched" : "service_request_unmatched",
    request,
    supabase: client,
    userId: auth.user.id,
    userRole: auth.role,
    properties: {
      role: auth.role,
      market: marketCode,
      area: area ?? undefined,
      propertyId: property?.id ?? undefined,
      requesterRole: auth.role,
      category: payload.category,
      entrypointSource: payload.entrypointSource,
      matchedProviderCount: matchedProviders.length,
    },
  });

  await deps.logProductAnalyticsEvent({
    eventName:
      readiness.status === "route_ready"
        ? "property_prep_request_route_ready"
        : "property_prep_request_manual_routing_required",
    request,
    supabase: client,
    userId: auth.user.id,
    userRole: auth.role,
    properties: {
      role: auth.role,
      market: marketCode,
      city: city ?? undefined,
      area: area ?? undefined,
      propertyId: property?.id ?? undefined,
      requesterRole: auth.role,
      category: payload.category,
      entrypointSource: payload.entrypointSource,
      matchedProviderCount: readiness.eligibleApprovedProviderCount,
      requestStatus: requestStatus,
    },
  });

  return NextResponse.json({
    ok: true,
    requestId: requestRow.id,
    status: requestStatus,
    matchedProviderCount: matchedProviders.length,
    deliveredProviderCount: sentCount,
  });
}

export async function POST(request: NextRequest) {
  return postMoveReadyServiceRequestResponse(request);
}
