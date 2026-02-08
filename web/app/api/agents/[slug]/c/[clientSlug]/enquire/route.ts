import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, getUserRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { safeTrim } from "@/lib/agents/agent-storefront";
import { getAgentClientPagePublic } from "@/lib/agents/agent-client-pages.server";
import { findCuratedListing } from "@/lib/agents/client-page-enquiry";
import { createLeadThreadAndMessage } from "@/lib/leads/lead-create.server";
import { ensureSessionCookie } from "@/lib/analytics/session.server";
import { logPropertyEvent } from "@/lib/analytics/property-events.server";
import { insertLeadAttribution } from "@/lib/leads/lead-attribution";
import { logFailure } from "@/lib/observability";
import { requireLegalAcceptance } from "@/lib/legal/guard.server";

const routeLabel = "/api/agents/[slug]/c/[clientSlug]/enquire";

const enquirySchema = z.object({
  propertyId: z.string().uuid(),
  message: z.string().min(10).max(1500),
  consent: z.boolean(),
  source: z.string().optional(),
  clientPageId: z.string().uuid().optional().nullable(),
});

export type ClientPageEnquiryDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  requireLegalAcceptance: typeof requireLegalAcceptance;
  getAgentClientPagePublic: typeof getAgentClientPagePublic;
  findCuratedListing: typeof findCuratedListing;
  createLeadThreadAndMessage: typeof createLeadThreadAndMessage;
  ensureSessionCookie: typeof ensureSessionCookie;
  logPropertyEvent: typeof logPropertyEvent;
  insertLeadAttribution: typeof insertLeadAttribution;
  logFailure: typeof logFailure;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
};

const defaultDeps: ClientPageEnquiryDeps = {
  hasServerSupabaseEnv,
  requireUser,
  getUserRole,
  requireLegalAcceptance,
  getAgentClientPagePublic,
  findCuratedListing,
  createLeadThreadAndMessage,
  ensureSessionCookie,
  logPropertyEvent,
  insertLeadAttribution,
  logFailure,
  hasServiceRoleEnv,
  createServiceRoleClient,
};

export async function postClientPageEnquiryResponse(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string; clientSlug?: string }> },
  deps: ClientPageEnquiryDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(auth.supabase, auth.user.id);
  if (role !== "tenant") {
    return NextResponse.json({ error: "Only tenants can submit enquiries." }, { status: 403 });
  }

  const legalCheck = await deps.requireLegalAcceptance({
    request,
    supabase: auth.supabase,
    userId: auth.user.id,
    role,
  });
  if (!legalCheck.ok) return legalCheck.response;

  const resolvedParams = await params;
  const slug = safeTrim(resolvedParams?.slug);
  const clientSlug = safeTrim(resolvedParams?.clientSlug);
  if (!slug || !clientSlug) {
    return NextResponse.json({ error: "Missing client page slug." }, { status: 400 });
  }

  const payload = enquirySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid enquiry payload." }, { status: 400 });
  }

  if (!payload.data.consent) {
    return NextResponse.json({ error: "Consent is required." }, { status: 400 });
  }

  let data = await deps.getAgentClientPagePublic({
    agentSlug: slug,
    clientSlug,
    requestId: `client-page-enquiry-${Date.now()}`,
  });

  if (!data.ok && data.redirectSlug) {
    data = await deps.getAgentClientPagePublic({
      agentSlug: data.redirectSlug,
      clientSlug,
      requestId: `client-page-enquiry-${Date.now()}-redirect`,
    });
  }

  if (!data.ok) {
    if (data.reason === "GLOBAL_DISABLED") {
      return NextResponse.json(
        { error: "Client pages are temporarily unavailable." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Client page unavailable." }, { status: 404 });
  }

  const listing = deps.findCuratedListing(data.listings, payload.data.propertyId);
  if (!listing) {
    return NextResponse.json({ error: "Listing not available in this shortlist." }, { status: 404 });
  }

  const leadResult = await deps.createLeadThreadAndMessage({
    supabase: auth.supabase,
    property: listing,
    buyerId: auth.user.id,
    buyerRole: role,
    message: payload.data.message,
    allowListingIntent: "any",
    request,
    route: routeLabel,
    startTime,
  });

  if (!leadResult.ok) {
    return NextResponse.json(
      { error: leadResult.error, code: leadResult.code },
      { status: leadResult.status }
    );
  }

  const lead = leadResult.lead as { id: string };

  const response = NextResponse.json({
    lead,
    thread_id: leadResult.threadId,
    message: leadResult.message,
  });

  const sessionKey = deps.ensureSessionCookie(request, response);
  void deps.logPropertyEvent({
    supabase: auth.supabase,
    propertyId: listing.id,
    eventType: "lead_created",
    actorUserId: auth.user.id,
    actorRole: role,
    sessionKey,
    meta: {
      intent: leadResult.leadIntent,
      source: "client_page",
      clientPageId: data.client.id,
    },
  });

  if (deps.hasServiceRoleEnv()) {
    const adminClient = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
    const attribution = await deps.insertLeadAttribution(adminClient, {
      lead_id: lead.id,
      agent_user_id: data.agent.id,
      client_page_id: data.client.id,
      presenting_agent_id: data.agent.id,
      owner_user_id: listing.owner_id,
      listing_id: listing.id,
      source: "client_page",
    });

    if (!attribution.ok) {
      deps.logFailure({
        request,
        route: routeLabel,
        status: 200,
        startTime,
        error: new Error(attribution.error || "Lead attribution failed."),
      });
    } else {
      void deps.logPropertyEvent({
        supabase: auth.supabase,
        propertyId: listing.id,
        eventType: "lead_attributed",
        actorUserId: auth.user.id,
        actorRole: role,
        sessionKey,
        meta: {
          source: "client_page",
          clientPageId: data.client.id,
          presentingAgentId: data.agent.id,
          ownerUserId: listing.owner_id,
        },
      });
    }
  }

  return response;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string; clientSlug?: string }> }
) {
  return postClientPageEnquiryResponse(request, { params });
}
