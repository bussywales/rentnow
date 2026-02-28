import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildExploreAnalyticsCsv } from "@/lib/explore/explore-analytics-export";
import {
  fetchExploreAnalyticsRows,
  resolveExploreAnalyticsRange,
  toExploreAnalyticsEvents,
} from "@/lib/explore/explore-analytics.server";

const routeLabel = "/api/admin/analytics/explore/export";

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const range = resolveExploreAnalyticsRange({
    date: searchParams.get("date"),
    start: searchParams.get("start"),
    end: searchParams.get("end"),
  });

  const supabase = hasServiceRoleEnv() ? createServiceRoleClient() : await createServerSupabaseClient();
  const rows = await fetchExploreAnalyticsRows({
    client: supabase,
    startIso: range.startIso,
    endIso: range.endIso,
    limit: 50000,
  });
  const csv = buildExploreAnalyticsCsv(toExploreAnalyticsEvents(rows));
  const filename =
    range.startDate === range.endDate
      ? `explore-analytics-${range.startDate}.csv`
      : `explore-analytics-${range.startDate}-to-${range.endDate}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
