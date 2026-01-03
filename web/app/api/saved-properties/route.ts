import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/saved-properties";

const saveSchema = z.object({
  property_id: z.string(),
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
      { error: "Supabase is not configured; favourites require a live backend.", saved: [] },
      { status: 503 }
    );
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const { data, error } = await supabase
    .from("saved_properties")
    .select("id, property_id, properties(*)")
    .eq("user_id", auth.user.id);

  if (error) {
    logFailure({
      request: new Request(routeLabel),
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ saved: data || [] });
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
      { error: "Supabase is not configured; favourites require a live backend." },
      { status: 503 }
    );
  }

  try {
    const auth = await requireUser({ request, route: routeLabel, startTime });
    if (!auth.ok) return auth.response;
    const supabase = auth.supabase;

    const body = await request.json();
    const { property_id: rawPropertyId } = saveSchema.parse(body);
    const property_id = (rawPropertyId || "").trim();
    if (!property_id) {
      return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
    }

    // Validate the property exists; also normalizes UUID parsing errors into a friendly message.
    const { data: exists, error: existsError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", property_id)
      .maybeSingle();

    if (existsError) {
      return NextResponse.json(
        { error: "Invalid property id. Please refresh and try again." },
        { status: 400 }
      );
    }
    if (!exists) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    const { error } = await supabase
      .from("saved_properties")
      .upsert({ user_id: auth.user.id, property_id });

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

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to save property";
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
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
      { error: "Supabase is not configured; favourites require a live backend." },
      { status: 503 }
    );
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("property_id");

  if (!propertyId) {
    return NextResponse.json({ error: "property_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("saved_properties")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("property_id", propertyId);

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

  return NextResponse.json({ ok: true });
}
