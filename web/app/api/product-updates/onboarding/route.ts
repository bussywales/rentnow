import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { fetchPublishedProductUpdates } from "@/lib/product-updates/product-updates.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/product-updates/onboarding";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  try {
    const role = await getUserRole(auth.supabase, auth.user.id);
    const { data: profile, error: profileError } = await auth.supabase
      .from("profiles")
      .select("onboarding_dismissed_at,last_seen_at")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const updates = await fetchPublishedProductUpdates({
      client: auth.supabase,
      role,
      limit: 3,
    });

    return NextResponse.json({
      dismissed_at: profile?.onboarding_dismissed_at ?? null,
      last_seen_at: profile?.last_seen_at ?? null,
      updates,
    });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: error instanceof Error ? error.message : "onboarding updates fetch failed",
    });
    return NextResponse.json({ error: "Unable to load updates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const now = new Date().toISOString();
  const { data, error } = await auth.supabase
    .from("profiles")
    .update({ onboarding_dismissed_at: now })
    .eq("id", auth.user.id)
    .select("onboarding_dismissed_at")
    .maybeSingle();

  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: error.message,
    });
    return NextResponse.json({ error: "Unable to update onboarding state" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, onboarding_dismissed_at: data?.onboarding_dismissed_at ?? now });
}
