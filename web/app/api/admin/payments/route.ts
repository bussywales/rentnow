import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { fetchAdminPayments } from "@/lib/payments/featured-payments.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/payments";

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
    return NextResponse.json({ error: "Service role not configured." }, { status: 503 });
  }

  const client = createServiceRoleClient();
  const filters = {
    status: request.nextUrl.searchParams.get("status"),
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
    limit: Number(request.nextUrl.searchParams.get("limit") || "100"),
  };

  try {
    const payments = await fetchAdminPayments({
      client: client as unknown as Parameters<typeof fetchAdminPayments>[0]["client"],
      filters,
    });
    return NextResponse.json({ ok: true, payments });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load payments." },
      { status: 400 }
    );
  }
}
