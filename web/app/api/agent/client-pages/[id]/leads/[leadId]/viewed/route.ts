import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { safeTrim } from "@/lib/agents/agent-storefront";
import { canAccessClientPageInbox } from "@/lib/agents/client-page-inbox";
import { logPropertyEvent, resolveEventSessionKey } from "@/lib/analytics/property-events.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/agent/client-pages/[id]/leads/[leadId]/viewed";

type RouteContext = { params: Promise<{ id: string; leadId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const resolvedParams = await params;
  const clientPageId = safeTrim(resolvedParams?.id);
  const leadId = safeTrim(resolvedParams?.leadId);

  if (!clientPageId || !leadId) {
    return NextResponse.json({ error: "Missing lead context." }, { status: 400 });
  }

  const supabase = auth.supabase;
  const { data: page } = await supabase
    .from("agent_client_pages")
    .select("id, agent_user_id")
    .eq("id", clientPageId)
    .maybeSingle();

  if (!page || !canAccessClientPageInbox({ viewerId: auth.user.id, clientPageOwnerId: page.agent_user_id })) {
    return NextResponse.json({ error: "Client page not found." }, { status: 404 });
  }

  const { data: lead } = await supabase
    .from("listing_leads")
    .select(
      "id, property_id, lead_attributions!inner(client_page_id)"
    )
    .eq("id", leadId)
    .eq("lead_attributions.client_page_id", clientPageId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if (lead.property_id) {
    const sessionKey = resolveEventSessionKey({ request, userId: auth.user.id });
    void logPropertyEvent({
      supabase,
      propertyId: lead.property_id,
      eventType: "client_page_lead_viewed",
      actorUserId: auth.user.id,
      actorRole: "agent",
      sessionKey,
      meta: { lead_id: leadId, clientPageId },
    });
  }

  return NextResponse.json({ ok: true });
}
