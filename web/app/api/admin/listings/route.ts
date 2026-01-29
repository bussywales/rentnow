import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { parseAdminListingsQuery, getAdminAllListings } from "@/lib/admin/admin-listings";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: "/api/admin/listings",
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const rawParams: Record<string, string | string[]> = {};
  const params = new URL(request.url).searchParams;
  for (const [key, value] of params.entries()) {
    const existing = rawParams[key];
    if (existing === undefined) {
      rawParams[key] = value;
    } else if (Array.isArray(existing)) {
      rawParams[key] = [...existing, value];
    } else {
      rawParams[key] = [existing, value];
    }
  }
  const query = parseAdminListingsQuery(rawParams);
  const client = hasServiceRoleEnv() ? createServiceRoleClient() : auth.supabase;

  try {
    const result = await getAdminAllListings({
      client,
      query,
    });
    return NextResponse.json({
      items: result.rows,
      data: result.rows,
      total: result.count,
      count: result.count,
      page: result.page,
      pageSize: result.pageSize,
      contractDegraded: result.contractDegraded,
      query,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? "Failed to load listings" },
      { status: 500 }
    );
  }
}
