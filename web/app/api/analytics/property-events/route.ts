import { NextResponse } from "next/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { buildPropertyEventSummary } from "@/lib/analytics/property-events";
import { fetchPropertyEvents } from "@/lib/analytics/property-events.server";

const routeLabel = "/api/analytics/property-events";

export async function GET(request: Request) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const supabase = auth.supabase;
  const role = await getUserRole(supabase, auth.user.id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("property_id");
  const days = Number(searchParams.get("days") ?? "7");
  if (!propertyId) {
    return NextResponse.json({ error: "property_id is required" }, { status: 400 });
  }

  if (role !== "admin") {
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (!property || property.owner_id !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const analyticsClient = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const { rows, error } = await fetchPropertyEvents({
    propertyIds: [propertyId],
    sinceDays: Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 7,
    client: analyticsClient,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const summaryMap = buildPropertyEventSummary(rows);
  const summary = summaryMap.get(propertyId) ?? null;

  return NextResponse.json({ summary });
}
