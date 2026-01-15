import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/viewings/tenant";

export async function GET(request: Request) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; viewing requests are unavailable." },
      { status: 503 }
    );
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant"],
  });
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await auth.supabase
      .from("viewing_requests")
      .select(
        "id, status, preferred_times, message, created_at, properties:properties!inner(id, title, city, neighbourhood, timezone)"
      )
      .eq("tenant_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json(
        { error: "Unable to load viewing requests" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, viewings: data || [] });
  } catch (err) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json(
      { error: "Unable to load viewing requests" },
      { status: 500 }
    );
  }
}
