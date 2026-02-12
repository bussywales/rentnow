import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  fetchFeaturedRequestsQueue,
  parseFeaturedRequestFilters,
} from "@/lib/featured/requests.server";

const routeLabel = "/api/admin/featured/requests";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const filters = parseFeaturedRequestFilters(request.nextUrl.searchParams);
  const client = hasServiceRoleEnv()
    ? (createServiceRoleClient() as unknown as SupabaseClient)
    : (auth.supabase as unknown as SupabaseClient);

  try {
    const requests = await fetchFeaturedRequestsQueue({ client, filters });
    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message || "Unable to load featured requests." },
      { status: 400 }
    );
  }
}
