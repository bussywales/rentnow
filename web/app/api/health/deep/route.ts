import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";

export async function GET(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/health/deep";

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      {
        ok: false,
        latencyMs: 0,
        supabaseReachable: false,
        errorReason: "Supabase env vars missing",
      },
      { status: 503 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const queryStart = Date.now();
    const { error } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .limit(1);
    const latencyMs = Math.max(0, Date.now() - queryStart);

    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 503,
        startTime,
        error,
      });
      return NextResponse.json(
        {
          ok: false,
          latencyMs,
          supabaseReachable: false,
          errorReason: error.message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      latencyMs,
      supabaseReachable: true,
    });
  } catch (err) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json(
      {
        ok: false,
        latencyMs: 0,
        supabaseReachable: false,
        errorReason: "Supabase query failed",
      },
      { status: 500 }
    );
  }
}
