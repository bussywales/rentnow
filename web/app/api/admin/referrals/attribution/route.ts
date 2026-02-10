import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getAdminReferralAttributionOverview } from "@/lib/referrals/share-tracking.server";

const routeLabel = "/api/admin/referrals/attribution";

export async function GET(request: Request) {
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

  const adminClient = createServiceRoleClient();
  const summary = await getAdminReferralAttributionOverview({
    client: adminClient,
    topLimit: 20,
  });

  return NextResponse.json({ ok: true, summary });
}
