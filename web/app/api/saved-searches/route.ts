import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/saved-searches";

const createSchema = z.object({
  name: z.string().min(2),
  query_params: z.record(z.string(), z.unknown()),
});

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
      { error: "Supabase is not configured; saved searches are unavailable.", searches: [] },
      { status: 503 }
    );
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("saved_searches")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ error: error.message, searches: [] }, { status: 400 });
  }

  return NextResponse.json({ searches: data || [] });
}

export async function POST(request: Request) {
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
      { error: "Supabase is not configured; saved searches are unavailable." },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: routeLabel,
    startTime,
    supabase,
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const payload = createSchema.parse(body);
    const { data, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: auth.user.id,
        name: payload.name,
        query_params: payload.query_params,
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

    return NextResponse.json({ search: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unable to save search";
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
