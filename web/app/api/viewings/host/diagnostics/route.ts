import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/viewings/host/diagnostics";

export async function GET(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime: Date.now(),
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const supabase = await createServerSupabaseClient();

  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", auth.user.id);

  const ownedIds = (properties || []).map((p) => p.id).filter(Boolean);

  let viewingsCountForOwnedProperties = 0;
  let sample: Array<{ id?: string; property_id?: string; status?: string; created_at?: string }> = [];

  if (ownedIds.length) {
    const { count, data } = await supabase
      .from("viewing_requests")
      .select("id, property_id, status, created_at", { count: "exact" })
      .in("property_id", ownedIds)
      .order("created_at", { ascending: false })
      .limit(5);
    viewingsCountForOwnedProperties = count || 0;
    sample = (data || []).map((v) => ({
      id: v.id,
      property_id: v.property_id,
      status: v.status,
      created_at: v.created_at,
    }));
  }

  return NextResponse.json({
    ok: true,
    userId: auth.user.id,
    ownedPropertyCount: ownedIds.length,
    ownedPropertyIdsSample: ownedIds.slice(0, 5),
    viewingsCountForOwnedProperties,
    viewingsSample: sample,
  });
}
