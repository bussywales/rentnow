import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/jobs/expire-listings";
const CRON_SECRET = process.env.LISTING_EXPIRY_JOB_SECRET;

function hasValidSecret(request: NextRequest) {
  if (!CRON_SECRET) return false;
  const provided = request.headers.get("x-cron-secret");
  return provided === CRON_SECRET;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const secretOk = hasValidSecret(request);
  if (!secretOk) {
    const auth = await requireRole({
      request,
      route: routeLabel,
      startTime,
      roles: ["admin"],
    });
    if (!auth.ok) return auth.response;
  }

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const admin = createServiceRoleClient() as unknown as UntypedAdminClient;
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("properties")
    .update({
      status: "expired",
      expired_at: nowIso,
      is_active: false,
      status_updated_at: nowIso,
      updated_at: nowIso,
    })
    .eq("status", "live")
    .not("expires_at", "is", null)
    .lt("expires_at", nowIso)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expiredCount: data?.length ?? 0 });
}
