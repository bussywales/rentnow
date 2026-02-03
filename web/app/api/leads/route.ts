import { NextResponse } from "next/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { leadCreateSchema } from "@/lib/leads/lead-schema";
import { LEAD_STATUSES } from "@/lib/leads/types";
import {
  CONTACT_EXCHANGE_BLOCK_CODE,
  CONTACT_EXCHANGE_BLOCK_MESSAGE,
  sanitizeMessageContent,
} from "@/lib/messaging/contact-exchange";
import { getContactExchangeMode } from "@/lib/settings/app-settings.server";
import { logFailure } from "@/lib/observability";
import { withDeliveryState } from "@/lib/messaging/status";
import { ensureSessionCookie } from "@/lib/analytics/session.server";
import { logPropertyEvent } from "@/lib/analytics/property-events.server";

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
      owner:profiles!listing_leads_owner_id_fkey(id, full_name, role)`
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

  const contactMode = await getContactExchangeMode(supabase);
  const sanitized = sanitizeMessageContent(parsed.data.message, contactMode);
  if (sanitized.action === "block") {
    return NextResponse.json(
      { error: CONTACT_EXCHANGE_BLOCK_MESSAGE, code: CONTACT_EXCHANGE_BLOCK_CODE },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { data: threadRow, error: threadError } = await supabase
    .from("message_threads")
    .upsert(
      {
        property_id: property.id,
        tenant_id: auth.user.id,
        host_id: property.owner_id,
        subject: property.title ?? null,
        last_post_at: now,
      },
      { onConflict: "property_id,tenant_id,host_id" }
    )
    .select("id")
    .single();

  if (threadError || !threadRow) {
    return NextResponse.json({ error: threadError?.message || "Unable to create thread" }, { status: 400 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("listing_leads")
    .insert({
      property_id: property.id,
      owner_id: property.owner_id,
      buyer_id: auth.user.id,
      thread_id: threadRow.id,
      status: LEAD_STATUSES[0],
      intent: parsed.data.intent ?? "BUY",
      budget_min: parsed.data.budget_min ?? null,
      budget_max: parsed.data.budget_max ?? null,
      financing_status: parsed.data.financing_status ?? null,
      timeline: parsed.data.timeline ?? null,
      message: sanitized.text,
      message_original: contactMode === "off" ? parsed.data.message : null,
      contact_exchange_flags: sanitized.meta ? { moderation: sanitized.meta } : null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: leadError?.message || "Unable to save enquiry" }, { status: 400 });
  }

  const systemMessage = `New buy enquiry submitted.\n\n${sanitized.text}`;
  const { data: posted, error: postError } = await supabase
    .from("messages")
    .insert({
      thread_id: threadRow.id,
      property_id: property.id,
      sender_id: auth.user.id,
      recipient_id: property.owner_id,
      body: systemMessage,
      sender_role: role,
      metadata: {
        lead_id: lead.id,
        moderation: sanitized.meta ?? undefined,
      },
    })
    .select()
    .single();

  if (postError) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(postError.message),
    });
  } else {
    await supabase
      .from("message_threads")
      .update({ last_post_at: now })
      .eq("id", threadRow.id);
  }

  const response = NextResponse.json({
    lead,
    thread_id: threadRow.id,
    message: posted ? withDeliveryState(posted) : null,
  });
  const sessionKey = ensureSessionCookie(request, response);
  void logPropertyEvent({
    supabase,
    propertyId: property.id,
    eventType: "lead_created",
    actorUserId: auth.user.id,
    actorRole: role,
    sessionKey,
    meta: { intent: parsed.data.intent ?? "BUY" },
  });
  return response;
}
