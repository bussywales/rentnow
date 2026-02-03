import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { ensureSessionCookie } from "@/lib/analytics/session.server";
import { logPropertyEvent } from "@/lib/analytics/property-events.server";

const routeLabel = "/api/saved-properties";

const saveSchema = z.object({
  property_id: z.string(),
});

export type SavedPropertiesDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireUser: typeof requireUser;
  logFailure: typeof logFailure;
};

const defaultDeps: SavedPropertiesDeps = {
  hasServerSupabaseEnv,
  requireUser,
  logFailure,
};

export async function getSavedPropertiesResponse(
  request: Request,
  deps: SavedPropertiesDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    deps.logFailure({
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

  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const { data, error } = await supabase
    .from("saved_properties")
    .select("id, property_id, properties(*)")
    .eq("user_id", auth.user.id);

  if (error) {
    deps.logFailure({
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

export async function postSavedPropertiesResponse(
  request: Request,
  deps: SavedPropertiesDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    deps.logFailure({
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
    const auth = await deps.requireUser({ request, route: routeLabel, startTime });
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
      deps.logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });
    const role = await getUserRole(supabase, auth.user.id);
    const sessionKey = ensureSessionCookie(request, response);
    void logPropertyEvent({
      supabase,
      propertyId: property_id,
      eventType: "save_toggle",
      actorUserId: auth.user.id,
      actorRole: role,
      sessionKey,
      meta: { action: "save" },
    });
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to save property";
    deps.logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function deleteSavedPropertiesResponse(
  request: Request,
  deps: SavedPropertiesDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServerSupabaseEnv()) {
    deps.logFailure({
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

  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
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
    deps.logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  const role = await getUserRole(supabase, auth.user.id);
  const sessionKey = ensureSessionCookie(request, response);
  void logPropertyEvent({
    supabase,
    propertyId,
    eventType: "save_toggle",
    actorUserId: auth.user.id,
    actorRole: role,
    sessionKey,
    meta: { action: "unsave" },
  });
  return response;
}

export async function GET(request: Request) {
  return getSavedPropertiesResponse(request);
}

export async function POST(request: Request) {
  return postSavedPropertiesResponse(request);
}

export async function DELETE(request: Request) {
  return deleteSavedPropertiesResponse(request);
}
