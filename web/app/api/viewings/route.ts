import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";

const viewingSchema = z.object({
  property_id: z.string().uuid(),
  preferred_date: z.string(),
  preferred_time_window: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/viewings";

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; viewing requests are demo-only right now." },
      { status: 503 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logFailure({
        request,
        route: routeLabel,
        status: 401,
        startTime,
        error: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const payload = viewingSchema.parse(body);

    const { data, error } = await supabase
      .from("viewing_requests")
      .insert({
        ...payload,
        tenant_id: user.id,
      })
      .select()
      .single();

    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ viewing: data });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unable to create viewing request";
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
