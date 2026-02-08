import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/admin/commission-agreements";

export async function GET(request: Request) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("agent_commission_agreements")
    .select(
      "id, listing_id, owner_agent_id, presenting_agent_id, commission_type, commission_value, currency, status, notes, created_at, accepted_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ agreements: data ?? [] });
}
