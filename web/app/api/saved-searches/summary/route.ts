import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getSavedSearchSummaryForUser } from "@/lib/saved-searches/summary.server";

const routeLabel = "/api/saved-searches/summary";

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
      {
        error: "Supabase is not configured; saved search summary is unavailable.",
        totalNewMatches: 0,
        searches: [],
      },
      { status: 503 }
    );
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  try {
    const summary = await getSavedSearchSummaryForUser({
      supabase: auth.supabase,
      userId: auth.user.id,
    });
    return NextResponse.json(summary);
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    const message =
      error instanceof Error ? error.message : "Unable to load saved search summary.";
    return NextResponse.json(
      { error: message, totalNewMatches: 0, searches: [] },
      { status: 500 }
    );
  }
}
