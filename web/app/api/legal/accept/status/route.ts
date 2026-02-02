import { NextResponse } from "next/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { DEFAULT_JURISDICTION } from "@/lib/legal/constants";
import { getLegalAcceptanceStatus } from "@/lib/legal/acceptance.server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/legal/accept/status";

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(auth.supabase, auth.user.id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const jurisdiction = (searchParams.get("jurisdiction") || DEFAULT_JURISDICTION).toUpperCase();

  const status = await getLegalAcceptanceStatus({
    userId: auth.user.id,
    role,
    jurisdiction,
    supabase: auth.supabase,
  });

  return NextResponse.json({
    ok: true,
    jurisdiction: status.jurisdiction,
    required_audiences: status.requiredAudiences,
    accepted_audiences: status.acceptedAudiences,
    missing_audiences: status.missingAudiences,
    is_complete: status.isComplete,
  });
}
