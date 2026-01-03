import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/agent-delegations";

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const userId = auth.user.id;
  const supabase = hasServiceRoleEnv() ? createServiceRoleClient() : auth.supabase;

  const runQuery = async (includeProfile: boolean) => {
    if (!includeProfile) {
      return supabase
        .from("agent_delegations")
        .select("id, landlord_id, status, created_at, approved_at")
        .eq("agent_id", userId)
        .eq("status", "active");
    }
    return supabase
      .from("agent_delegations")
      .select(
        "id, landlord_id, status, created_at, approved_at, landlord:profiles!agent_delegations_landlord_id_fkey(full_name, business_name, city)"
      )
      .eq("agent_id", userId)
      .eq("status", "active");
  };

  const initial = await runQuery(true);
  if (initial.error) {
    const fallback = await runQuery(false);
    if (fallback.error) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(fallback.error.message),
      });
      return NextResponse.json({ error: fallback.error.message }, { status: 400 });
    }
    return NextResponse.json({ delegations: fallback.data || [] }, { status: 200 });
  }

  return NextResponse.json({ delegations: initial.data || [] }, { status: 200 });
}
