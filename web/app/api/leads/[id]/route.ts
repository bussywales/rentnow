import { NextRequest, NextResponse } from "next/server";
import { requireUser, getUserRole, requireOwnership } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { leadStatusUpdateSchema } from "@/lib/leads/lead-schema";
import {
  isUuid,
  logPropertyEvent,
  resolveEventSessionKey,
} from "@/lib/analytics/property-events.server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const startTime = Date.now();
  const routeLabel = `/api/leads/${id}`;

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(auth.supabase, auth.user.id);
  if (role !== "landlord" && role !== "agent" && role !== "admin") {
    return NextResponse.json({ error: "Only listing owners can update leads." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = leadStatusUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status update" }, { status: 400 });
  }
  const requestedClientPageId =
    typeof parsed.data.clientPageId === "string" ? parsed.data.clientPageId : null;

  const { data: lead } = await auth.supabase
    .from("listing_leads")
    .select("id, owner_id, property_id")
    .eq("id", id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const ownership = requireOwnership({
    request,
    route: routeLabel,
    startTime,
    resourceOwnerId: lead.owner_id,
    userId: auth.user.id,
    role,
  });
  if (!ownership.ok) return ownership.response;

  const { data, error } = await auth.supabase
    .from("listing_leads")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to update lead" }, { status: 400 });
  }

  const response = NextResponse.json({ lead: data });

  if (lead.property_id) {
    const sessionKey = resolveEventSessionKey({ request, userId: auth.user.id });
    void logPropertyEvent({
      supabase: auth.supabase,
      propertyId: lead.property_id,
      eventType: "lead_status_updated",
      actorUserId: auth.user.id,
      actorRole: role,
      sessionKey,
      meta: { lead_id: lead.id, status: parsed.data.status },
    });

    if (requestedClientPageId && isUuid(requestedClientPageId)) {
      const { data: attribution } = await auth.supabase
        .from("lead_attributions")
        .select("client_page_id")
        .eq("lead_id", lead.id)
        .eq("client_page_id", requestedClientPageId)
        .maybeSingle();

      if (attribution) {
        void logPropertyEvent({
          supabase: auth.supabase,
          propertyId: lead.property_id,
          eventType: "client_page_lead_status_updated",
          actorUserId: auth.user.id,
          actorRole: role,
          sessionKey,
          meta: {
            lead_id: lead.id,
            status: parsed.data.status,
            clientPageId: requestedClientPageId,
          },
        });
      }
    }

    if (parsed.data.status === "WON" || parsed.data.status === "LOST") {
      const { data: attribution } = await auth.supabase
        .from("lead_attributions")
        .select("presenting_agent_id, listing_id")
        .eq("lead_id", lead.id)
        .maybeSingle();

      if (attribution?.presenting_agent_id && attribution.listing_id) {
        const { data: agreement } = await auth.supabase
          .from("agent_commission_agreements")
          .select("id, status")
          .eq("listing_id", attribution.listing_id)
          .eq("presenting_agent_id", attribution.presenting_agent_id)
          .maybeSingle();

        if (agreement?.status === "accepted") {
          const event = parsed.data.status === "WON" ? "deal_marked_won" : "deal_marked_lost";
          const { data: existingEvent } = await auth.supabase
            .from("agent_commission_events")
            .select("id")
            .eq("agreement_id", agreement.id)
            .eq("lead_id", lead.id)
            .eq("event", event)
            .maybeSingle();

          if (!existingEvent) {
            await auth.supabase
              .from("agent_commission_events")
              .insert({
                agreement_id: agreement.id,
                lead_id: lead.id,
                event,
                marked_by: auth.user.id,
              });
          }
        }
      }
    }
  }

  return response;
}
