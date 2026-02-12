import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  buildAdminCashoutCsv,
  fetchAdminCashoutQueue,
  parseAdminCashoutQueueFilters,
} from "@/lib/referrals/cashout-admin.server";

const routeLabel = "/api/admin/referrals/cashouts/export.csv";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const adminClient = createServiceRoleClient() as unknown as SupabaseClient;
  const filters = parseAdminCashoutQueueFilters(request.nextUrl.searchParams);
  const rows = await fetchAdminCashoutQueue({
    client: adminClient,
    filters: {
      ...filters,
      limit: Math.max(1, Math.min(5000, Math.trunc(filters.limit || 1000))),
    },
  });
  const csv = buildAdminCashoutCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="referral-cashouts-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
