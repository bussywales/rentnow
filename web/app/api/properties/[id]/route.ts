import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getEnvPresence } from "@/lib/env";

function getRequestId(request: Request) {
  return request.headers.get("x-request-id") || request.headers.get("x-vercel-id");
}

function logApiFailure(
  request: Request,
  status: number,
  message: string,
  meta: Record<string, unknown> = {}
) {
  const requestId = getRequestId(request);
  console.error("[api/properties/[id]] request failed", {
    status,
    url: request.url,
    requestId: requestId || undefined,
    env: getEnvPresence(),
    message,
    ...meta,
  });
}

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  city: z.string().min(2).optional(),
  neighbourhood: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  rental_type: z.enum(["short_let", "long_term"]).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().min(2).optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  furnished: z.boolean().optional(),
  amenities: z.array(z.string()).optional().nullable(),
  available_from: z.string().optional().nullable(),
  max_guests: z.number().int().nullable().optional(),
  is_active: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasServerSupabaseEnv()) {
    logApiFailure(request, 503, "Supabase env vars missing");
    return NextResponse.json(
      { error: "Supabase is not configured; properties are read-only in demo mode." },
      { status: 503 }
    );
  }

  const { id } = idParamSchema.parse(await context.params);
  const isUuid = uuidRegex.test(id);
  if (id === "undefined" || id === "null" || (!isUuid && !id.startsWith("mock-"))) {
    logApiFailure(request, 404, "Invalid property id", { id });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const ownerOnly = scope === "own";

  if (ownerOnly) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logApiFailure(request, 401, "Unauthorized", { id, scope });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin = profile?.role === "admin";

    let query = supabase
      .from("properties")
      .select("*, property_images(id, image_url)")
      .eq("id", id);

    if (!isAdmin) {
      query = query.eq("owner_id", user.id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logApiFailure(request, 400, "Fetch failed", { id, error: error.message, scope });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      logApiFailure(request, 404, "Property not found", { id, scope });
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    return NextResponse.json({ property: data });
  }

  const { data, error } = await supabase
    .from("properties")
    .select("*, property_images(id, image_url)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logApiFailure(request, 400, "Fetch failed", { id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    logApiFailure(request, 404, "Property not found", { id });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json({ property: data });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasServerSupabaseEnv()) {
    logApiFailure(request, 503, "Supabase env vars missing");
    return NextResponse.json(
      { error: "Supabase is not configured; editing requires a live backend." },
      { status: 503 }
    );
  }

  const { id } = idParamSchema.parse(await context.params);
  try {
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    const supabase = await createServerSupabaseClient();
    const userResult = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();
    const {
      data: { user },
      error: authError,
    } = userResult;

    if (authError || !user) {
      logApiFailure(request, 401, "Unauthorized", { id });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [{ data: existing, error: fetchError }, { data: profile }] = await Promise.all([
      supabase.from("properties").select("owner_id").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);

    if (fetchError || !existing) {
      logApiFailure(request, 404, "Property not found", {
        id,
        fetchError: fetchError?.message,
      });
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const isAdmin = profile?.role === "admin";

    if (existing.owner_id !== user.id && !isAdmin) {
      logApiFailure(request, 403, "Forbidden", { id, owner_id: existing.owner_id });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updates = updateSchema.parse(body);
    const { imageUrls = [], ...rest } = updates;

    const { error: updateError } = await supabase
      .from("properties")
      .update({
        ...rest,
        amenities: rest.amenities ?? [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      logApiFailure(request, 400, "Update failed", { id, error: updateError.message });
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    if (imageUrls) {
      await supabase.from("property_images").delete().eq("property_id", id);
      if (imageUrls.length) {
        await supabase.from("property_images").insert(
          imageUrls.map((url) => ({
            property_id: id,
            image_url: url,
          }))
        );
      }
    }

    return NextResponse.json({ id });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to update property";
    logApiFailure(request, 500, "Unhandled error on PUT", { id, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasServerSupabaseEnv()) {
    logApiFailure(request, 503, "Supabase env vars missing");
    return NextResponse.json(
      { error: "Supabase is not configured; deletion is unavailable in demo mode." },
      { status: 503 }
    );
  }

  const { id } = idParamSchema.parse(await context.params);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    logApiFailure(request, 401, "Unauthorized", { id });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    logApiFailure(request, 404, "Property not found", {
      id,
      fetchError: fetchError?.message,
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (existing.owner_id !== user.id) {
    logApiFailure(request, 403, "Forbidden", { id, owner_id: existing.owner_id });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("properties").delete().eq("id", id);

  if (error) {
    logApiFailure(request, 400, "Delete failed", { id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id });
}
