import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  buildFeaturedRequestsCsv,
  fetchFeaturedRequestsQueue,
  parseFeaturedRequestFilters,
} from "@/lib/featured/requests.server";

const routeLabel = "/api/admin/featured/requests/export.csv";

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

  const rows = await fetchFeaturedRequestsQueue({
    client,
    filters: {
      ...filters,
      limit: Math.max(1, Math.min(5000, Math.trunc(filters.limit || 1000))),
    },
  });

  const csv = buildFeaturedRequestsCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="featured-requests-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
