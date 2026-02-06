import { NextRequest, NextResponse } from "next/server";
import { requireUser, getUserRole, requireOwnership } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { leadStatusUpdateSchema } from "@/lib/leads/lead-schema";
import { logPropertyEvent, resolveEventSessionKey } from "@/lib/analytics/property-events.server";

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
  }

  return response;
}
