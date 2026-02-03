import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  FEATURED_CITY_WARNING_THRESHOLD,
  FEATURED_EXPIRING_WINDOW_DAYS,
  getFeaturedInventorySummary,
} from "@/lib/admin/featured-inventory";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: "/api/admin/featured/summary",
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : auth.supabase;
  const params = new URL(request.url).searchParams;
  const city = params.get("city")?.trim() || null;

  try {
    const summary = await getFeaturedInventorySummary({
      client,
      expiringWindowDays: FEATURED_EXPIRING_WINDOW_DAYS,
    });

    if (city) {
      return NextResponse.json({
        city,
        count: summary.countsByCity[city] ?? 0,
        threshold: FEATURED_CITY_WARNING_THRESHOLD,
      });
    }

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to load featured inventory." },
      { status: 500 }
    );
  }
}
