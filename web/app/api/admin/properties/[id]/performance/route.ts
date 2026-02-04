import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import {
  buildSummaryByProperty,
  fetchPropertyEvents,
  isUuid,
} from "@/lib/analytics/property-events.server";
import { resolveHostPerformanceRange } from "@/lib/analytics/host-performance.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/properties/[id]/performance";
const DAY_MS = 24 * 60 * 60 * 1000;

const responseSchema = z.object({
  id: z.string(),
  rangeDays: z.number(),
  views: z.number(),
  saves: z.number(),
  enquiries: z.number(),
  lead_rate: z.number(),
  days_live: z.number(),
  series: z.array(
    z.object({
      date: z.string(),
      views: z.number(),
    })
  ),
});

type PropertyRow = {
  id: string;
  created_at?: string | null;
  approved_at?: string | null;
  updated_at?: string | null;
};

export type AdminPerformanceDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  logFailure: typeof logFailure;
  fetchPropertyEvents: typeof fetchPropertyEvents;
  buildSummaryByProperty: typeof buildSummaryByProperty;
  now?: () => Date;
};

const defaultDeps: AdminPerformanceDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireRole,
  logFailure,
  fetchPropertyEvents,
  buildSummaryByProperty,
};

function resolveDaysLive(listing: PropertyRow, now: Date) {
  const anchor = listing.approved_at || listing.created_at || listing.updated_at || null;
  if (!anchor) return 0;
  const anchorMs = Date.parse(anchor);
  if (Number.isNaN(anchorMs)) return 0;
  const diff = Math.max(0, now.getTime() - anchorMs);
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

function buildDailySeries({
  rows,
  rangeDays,
  now,
}: {
  rows: Array<{ occurred_at?: string | null; event_type?: string | null }>;
  rangeDays: number;
  now: Date;
}) {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - (rangeDays - 1) * DAY_MS);
  const totals = new Map<string, number>();

  for (const row of rows) {
    if (row.event_type !== "property_view" || !row.occurred_at) continue;
    const dateKey = row.occurred_at.slice(0, 10);
    totals.set(dateKey, (totals.get(dateKey) ?? 0) + 1);
  }

  const series: Array<{ date: string; views: number }> = [];
  for (let i = 0; i < rangeDays; i += 1) {
    const day = new Date(start.getTime() + i * DAY_MS);
    const key = day.toISOString().slice(0, 10);
    series.push({ date: key, views: totals.get(key) ?? 0 });
  }
  return series;
}

export async function getAdminPropertyPerformanceResponse(
  request: NextRequest,
  propertyId: string,
  deps: AdminPerformanceDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  if (!isUuid(propertyId)) {
    return NextResponse.json({ error: "Invalid property id" }, { status: 400 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const rangeDays = resolveHostPerformanceRange(request.nextUrl.searchParams.get("range"));
  const now = deps.now ? deps.now() : new Date();
  const adminClient = deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : null;
  const client = adminClient ?? auth.supabase;

  const { data: listing, error: listingError } = await client
    .from("properties")
    .select("id,created_at,approved_at,updated_at")
    .eq("id", propertyId)
    .maybeSingle();

  if (listingError || !listing) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: listingError || "Property not found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const { rows, error } = await deps.fetchPropertyEvents({
    propertyIds: [propertyId],
    sinceDays: rangeDays,
    client,
  });

  if (error) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Unable to load performance data" }, { status: 500 });
  }

  const summary = deps.buildSummaryByProperty(rows).get(propertyId);
  const views = summary?.views ?? 0;
  const saves = Math.max(summary?.netSaves ?? 0, 0);
  const enquiries = (summary?.enquiries ?? 0) + (summary?.viewingRequests ?? 0);
  const leadRate = enquiries / Math.max(views, 1);
  const daysLive = resolveDaysLive(listing as PropertyRow, now);
  const series = buildDailySeries({ rows, rangeDays, now });

  const payload = {
    id: propertyId,
    rangeDays,
    views,
    saves,
    enquiries,
    lead_rate: leadRate,
    days_live: daysLive,
    series,
  };

  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    deps.logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: parsed.error.message,
    });
    return NextResponse.json({ error: "Unable to format performance response" }, { status: 500 });
  }

  return NextResponse.json(parsed.data);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return getAdminPropertyPerformanceResponse(request, id);
}
