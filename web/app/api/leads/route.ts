import { NextResponse } from "next/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { leadCreateSchema } from "@/lib/leads/lead-schema";
import { logFailure } from "@/lib/observability";
import { ensureSessionCookie } from "@/lib/analytics/session.server";
import { isUuid, logPropertyEvent } from "@/lib/analytics/property-events.server";
import {
  canAttributeLeadToClientPage,
  insertLeadAttribution,
} from "@/lib/leads/lead-attribution";
import { createLeadThreadAndMessage } from "@/lib/leads/lead-create.server";

const routeLabel = "/api/leads";

export async function GET(request: Request) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const supabase = auth.supabase;
  const role = await getUserRole(supabase, auth.user.id);

  let query = supabase
    .from("listing_leads")
    .select(
      `id, property_id, owner_id, buyer_id, thread_id, status, intent, budget_min, budget_max, financing_status, timeline, message, contact_exchange_flags, created_at, updated_at,
      properties:properties(id, title, city, state_region, country_code),
      buyer:profiles!listing_leads_buyer_id_fkey(id, full_name, role),
      owner:profiles!listing_leads_owner_id_fkey(id, full_name, role),
      lead_attributions:lead_attributions(id, client_page_id, agent_user_id, source, created_at,
        client_page:agent_client_pages(id, client_slug, client_name, client_requirements, agent_slug)
      )`
    )
    .order("created_at", { ascending: false });

  if (role === "tenant") {
    query = query.eq("buyer_id", auth.user.id);
  } else if (role === "landlord" || role === "agent") {
    query = query.eq("owner_id", auth.user.id);
  }

  const { data, error } = await query;
  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ leads: data ?? [] });
}

export async function POST(request: Request) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const supabase = auth.supabase;
  const role = await getUserRole(supabase, auth.user.id);
  if (role !== "tenant") {
    return NextResponse.json({ error: "Only tenants can submit enquiries." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = leadCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid enquiry payload" }, { status: 400 });
  }

  if (!parsed.data.consent) {
    return NextResponse.json({ error: "Consent is required." }, { status: 400 });
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, owner_id, title, is_approved, is_active, listing_intent")
    .eq("id", parsed.data.property_id)
    .maybeSingle();

  if (propertyError || !property) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (property.listing_intent !== "buy") {
    return NextResponse.json({ error: "Enquiries are only available for buy listings." }, { status: 400 });
  }

  if (!property.is_approved || !property.is_active) {
    return NextResponse.json({ error: "Listing is not available." }, { status: 403 });
  }

  const clientPageId =
    typeof parsed.data.clientPageId === "string" ? parsed.data.clientPageId : null;
  const attributionRequested =
    parsed.data.source === "agent_client_page" && isUuid(clientPageId);
  let clientPage: {
    id: string;
    agent_user_id: string;
    client_slug: string | null;
    client_name: string | null;
    client_requirements: string | null;
    agent_slug: string | null;
    published?: boolean | null;
    expires_at?: string | null;
  } | null = null;

  if (attributionRequested) {
    const { data: clientPageRow } = await supabase
      .from("agent_client_pages")
      .select(
        "id, agent_user_id, client_slug, client_name, client_requirements, agent_slug, published, expires_at"
      )
      .eq("id", clientPageId as string)
      .maybeSingle();

    if (
      clientPageRow &&
      canAttributeLeadToClientPage({
        clientPage: {
          id: clientPageRow.id,
          agent_user_id: clientPageRow.agent_user_id,
          published: clientPageRow.published,
          expires_at: clientPageRow.expires_at,
        },
        propertyOwnerId: property.owner_id,
      })
    ) {
      clientPage = {
        id: clientPageRow.id,
        agent_user_id: clientPageRow.agent_user_id,
        client_slug: clientPageRow.client_slug ?? null,
        client_name: clientPageRow.client_name ?? null,
        client_requirements: clientPageRow.client_requirements ?? null,
        agent_slug: clientPageRow.agent_slug ?? null,
        published: clientPageRow.published ?? null,
        expires_at: clientPageRow.expires_at ?? null,
      };
    } else {
      logFailure({
        request,
        route: routeLabel,
        status: 200,
        startTime,
        error: new Error("Lead attribution skipped: invalid or unpublished client page."),
      });
    }
  }

  const leadResult = await createLeadThreadAndMessage({
    supabase,
    property,
    buyerId: auth.user.id,
    buyerRole: role,
    message: parsed.data.message,
    intent: parsed.data.intent ?? "BUY",
    budgetMin: parsed.data.budget_min ?? null,
    budgetMax: parsed.data.budget_max ?? null,
    financingStatus: parsed.data.financing_status ?? null,
    timeline: parsed.data.timeline ?? null,
    allowListingIntent: "buy",
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
    supabase,
    propertyId: property.id,
    eventType: "lead_created",
    actorUserId: auth.user.id,
    actorRole: role,
    sessionKey,
    meta: { intent: leadResult.leadIntent },
  });

  if (clientPage && hasServiceRoleEnv()) {
    const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
    const attributionResult = await insertLeadAttribution(adminClient, {
      lead_id: lead.id,
      agent_user_id: clientPage.agent_user_id,
      client_page_id: clientPage.id,
      source: "agent_client_page",
    });

    if (!attributionResult.ok) {
      logFailure({
        request,
        route: routeLabel,
        status: 200,
        startTime,
        error: new Error(attributionResult.error || "Lead attribution failed."),
      });
    } else {
      void logPropertyEvent({
        supabase,
        propertyId: property.id,
        eventType: "lead_attributed",
        actorUserId: auth.user.id,
        actorRole: role,
        sessionKey,
        meta: {
          source: "agent_client_page",
          clientPageId: clientPage.id,
          agentUserId: clientPage.agent_user_id,
        },
      });
    }
  }
  return response;
}
