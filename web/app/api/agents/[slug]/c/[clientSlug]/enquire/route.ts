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

const routeLabel = "/api/agents/[slug]/c/[clientSlug]/enquire";

const enquirySchema = z.object({
  propertyId: z.string().uuid(),
  message: z.string().min(10).max(1500),
  consent: z.boolean(),
  source: z.string().optional(),
  clientPageId: z.string().uuid().optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string; clientSlug?: string }> }
) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(auth.supabase, auth.user.id);
  if (role !== "tenant") {
    return NextResponse.json({ error: "Only tenants can submit enquiries." }, { status: 403 });
  }

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

  let data = await getAgentClientPagePublic({
    agentSlug: slug,
    clientSlug,
    requestId: `client-page-enquiry-${Date.now()}`,
  });

  if (!data.ok && data.redirectSlug) {
    data = await getAgentClientPagePublic({
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

  const listing = findCuratedListing(data.listings, payload.data.propertyId);
  if (!listing) {
    return NextResponse.json({ error: "Listing not available in this shortlist." }, { status: 404 });
  }

  if (listing.owner_id !== data.agent.id) {
    return NextResponse.json({ error: "Listing not available." }, { status: 403 });
  }

  const leadResult = await createLeadThreadAndMessage({
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

  const sessionKey = ensureSessionCookie(request, response);
  void logPropertyEvent({
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

  if (hasServiceRoleEnv()) {
    const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
    const attribution = await insertLeadAttribution(adminClient, {
      lead_id: lead.id,
      agent_user_id: data.agent.id,
      client_page_id: data.client.id,
      source: "agent_client_page",
    });

    if (!attribution.ok) {
      logFailure({
        request,
        route: routeLabel,
        status: 200,
        startTime,
        error: new Error(attribution.error || "Lead attribution failed."),
      });
    } else {
      void logPropertyEvent({
        supabase: auth.supabase,
        propertyId: listing.id,
        eventType: "lead_attributed",
        actorUserId: auth.user.id,
        actorRole: role,
        sessionKey,
        meta: {
          source: "agent_client_page",
          clientPageId: data.client.id,
          agentUserId: data.agent.id,
        },
      });
    }
  }

  return response;
}
