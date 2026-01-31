import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/admin/leads";

export async function GET(request: Request) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const adminClient = createServiceRoleClient();
  const { data, error } = await adminClient
    .from("listing_leads")
    .select(
      `id, property_id, owner_id, buyer_id, thread_id, status, intent, budget_min, budget_max, financing_status, timeline, message, contact_exchange_flags, created_at, updated_at,
      properties:properties(id, title, city, state_region, country_code),
      buyer:profiles!listing_leads_buyer_id_fkey(id, full_name, role),
      owner:profiles!listing_leads_owner_id_fkey(id, full_name, role)`
    )
    .order("created_at", { ascending: false });

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
