import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildExploreV2ConversionCsv,
  buildExploreV2ConversionReport,
  fetchExploreV2ConversionRows,
  resolveExploreV2ConversionQuery,
  type ExploreV2ConversionQuery,
} from "@/lib/explore/explore-v2-conversion-report";

const routeLabel = "/api/admin/analytics/explore-v2";

export type AdminExploreV2AnalyticsDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  resolveExploreV2ConversionQuery: typeof resolveExploreV2ConversionQuery;
  fetchExploreV2ConversionRows: typeof fetchExploreV2ConversionRows;
  buildExploreV2ConversionReport: typeof buildExploreV2ConversionReport;
  buildExploreV2ConversionCsv: typeof buildExploreV2ConversionCsv;
};

const defaultDeps: AdminExploreV2AnalyticsDeps = {
  requireRole,
  hasServiceRoleEnv,
  createServiceRoleClient,
  createServerSupabaseClient,
  resolveExploreV2ConversionQuery,
  fetchExploreV2ConversionRows,
  buildExploreV2ConversionReport,
  buildExploreV2ConversionCsv,
};

function buildCsvFilename(query: ExploreV2ConversionQuery) {
  const suffix =
    query.range.startDate === query.range.endDate
      ? query.range.startDate
      : `${query.range.startDate}-to-${query.range.endDate}`;
  return `explore-v2-conversion-${suffix}.csv`;
}

export async function getAdminExploreV2AnalyticsResponse(
  request: NextRequest,
  deps: AdminExploreV2AnalyticsDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const query = deps.resolveExploreV2ConversionQuery({
    date: searchParams.get("date"),
    start: searchParams.get("start"),
    end: searchParams.get("end"),
    market: searchParams.get("market"),
    intent: searchParams.get("intent"),
    format: searchParams.get("format"),
  });

  const supabase = deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : await deps.createServerSupabaseClient();
  const rows = await deps.fetchExploreV2ConversionRows({
    client: supabase,
    startIso: query.range.startIso,
    endIso: query.range.endIso,
    market: query.market,
    intent: query.intent,
    limit: 50000,
  });

  if (query.format === "csv") {
    const csv = deps.buildExploreV2ConversionCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildCsvFilename(query)}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const report = deps.buildExploreV2ConversionReport({
    rows,
    range: query.range,
    market: query.market,
    intent: query.intent,
  });
  return NextResponse.json({
    ok: true,
    ...report,
    row_count: rows.length,
  });
}

export async function GET(request: NextRequest) {
  return getAdminExploreV2AnalyticsResponse(request, defaultDeps);
}

export const dynamic = "force-dynamic";
