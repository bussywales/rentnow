import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getUserRole, requireOwnership, requireUser } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/properties/[id]";

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
  bills_included: z.boolean().optional(),
  epc_rating: z.string().optional().nullable(),
  council_tax_band: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  status: z.enum(["draft", "pending", "live", "rejected", "paused"]).optional(),
  rejection_reason: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getAnonEnv = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

async function createRequestSupabaseClient(accessToken?: string | null) {
  const env = accessToken ? getAnonEnv() : null;
  if (accessToken && env) {
    return createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }
  return createServerSupabaseClient();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
      { error: "Supabase is not configured; properties are read-only in demo mode." },
      { status: 503 }
    );
  }

  const { id } = idParamSchema.parse(await context.params);
  const isUuid = uuidRegex.test(id);
  if (id === "undefined" || id === "null" || (!isUuid && !id.startsWith("mock-"))) {
    logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: "Invalid property id",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const ownerOnly = scope === "own";

  const missingPosition = (message?: string | null) =>
    typeof message === "string" &&
    message.includes("position") &&
    message.includes("property_images");

  const buildQuery = (includePosition: boolean) => {
    const imageFields = includePosition
      ? "id, image_url, position, created_at"
      : "id, image_url, created_at";
    let query = supabase
      .from("properties")
      .select(`*, property_images(${imageFields})`)
      .eq("id", id);
    if (includePosition) {
      query = query
        .order("position", { foreignTable: "property_images", ascending: true })
        .order("created_at", { foreignTable: "property_images", ascending: true });
    } else {
      query = query.order("created_at", {
        foreignTable: "property_images",
        ascending: true,
      });
    }
    return query.maybeSingle();
  };

  let { data, error } = await buildQuery(true);
  if (error && missingPosition(error.message)) {
    const fallback = await buildQuery(false);
    data = fallback.data;
    error = fallback.error;
  }

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

  if (!data) {
    logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: "Property not found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const isPublic = data.is_approved === true && data.is_active === true;

  if (ownerOnly || !isPublic) {
    const auth = await requireUser({
      request,
      route: routeLabel,
      startTime,
      supabase,
    });
    if (!auth.ok) return auth.response;

    const role = await getUserRole(supabase, auth.user.id);
    const ownership = requireOwnership({
      request,
      route: routeLabel,
      startTime,
      resourceOwnerId: data.owner_id,
      userId: auth.user.id,
      role,
      allowRoles: ["admin"],
    });
    if (!ownership.ok) return ownership.response;
  }

  return NextResponse.json({ property: data });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const supabase = await createRequestSupabaseClient(bearerToken);
    const auth = await requireUser({
      request,
      route: routeLabel,
      startTime,
      supabase,
      accessToken: bearerToken,
    });
    if (!auth.ok) return auth.response;

    const role = await getUserRole(supabase, auth.user.id);
    if (!role || !["landlord", "agent", "admin"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const missingStatus = (message?: string | null) =>
      typeof message === "string" && message.includes("properties.status");

    const adminClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
    let existing: { owner_id: string } | null = null;
    let fetchError: { message: string } | null = null;
    let statusMissing = false;

    if (adminClient) {
      const initial = await adminClient
        .from("properties")
        .select("owner_id, status")
        .eq("id", id)
        .maybeSingle();
      if (initial.error && missingStatus(initial.error.message)) {
        statusMissing = true;
        const fallback = await adminClient
          .from("properties")
          .select("owner_id")
          .eq("id", id)
          .maybeSingle();
        existing = fallback.data ?? null;
        fetchError = fallback.error;
      } else {
        existing = (initial.data as { owner_id: string } | null) ?? null;
        fetchError = initial.error;
      }
    } else {
      const initial = await supabase
        .from("properties")
        .select("owner_id, status")
        .eq("id", id)
        .maybeSingle();
      if (initial.error && missingStatus(initial.error.message)) {
        statusMissing = true;
        const fallback = await supabase
          .from("properties")
          .select("owner_id")
          .eq("id", id)
          .maybeSingle();
        existing = fallback.data ?? null;
        fetchError = fallback.error;
      } else {
        existing = (initial.data as { owner_id: string } | null) ?? null;
        fetchError = initial.error;
      }
    }

    if (fetchError) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(fetchError.message),
      });
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    if (!existing) {
      logFailure({
        request,
        route: routeLabel,
        status: 404,
        startTime,
        error: "Property not found",
      });
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (statusMissing) {
      return NextResponse.json(
        {
          error: "DB migration required: properties.status",
          missingColumn: "properties.status",
          migration: "009_properties_workflow_columns.sql",
        },
        { status: 409 }
      );
    }
    const ownership = requireOwnership({
      request,
      route: routeLabel,
      startTime,
      resourceOwnerId: existing.owner_id,
      userId: auth.user.id,
      role,
      allowRoles: ["admin"],
    });
    if (!ownership.ok) return ownership.response;

    const body = await request.json();
    const updates = updateSchema.parse(body);
    const { imageUrls = [], status, rejection_reason, ...rest } = updates;
    const now = new Date().toISOString();
    const isAdmin = role === "admin";
    let statusUpdate: Record<string, unknown> = {};

    if (status) {
      const allowed = isAdmin
        ? ["draft", "pending", "live", "rejected", "paused"]
        : ["draft", "pending", "paused"];
      if (!allowed.includes(status)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      statusUpdate = {
        status,
        rejection_reason:
          status === "rejected" ? rejection_reason || "Rejected by admin" : null,
        submitted_at: status === "pending" ? now : null,
        approved_at: status === "live" ? now : null,
        rejected_at: status === "rejected" ? now : null,
        paused_at: status === "paused" ? now : null,
        is_active: status === "pending" || status === "live",
        is_approved: status === "live",
      };
    } else if (typeof rejection_reason !== "undefined" && isAdmin) {
      statusUpdate = { rejection_reason };
    }

    const { error: updateError } = await supabase
      .from("properties")
      .update({
        ...rest,
        amenities: rest.amenities ?? [],
        features: rest.features ?? [],
        updated_at: new Date().toISOString(),
        ...statusUpdate,
      })
      .eq("id", id);

    if (updateError) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(updateError.message),
      });
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    if (imageUrls) {
      await supabase.from("property_images").delete().eq("property_id", id);
      if (imageUrls.length) {
        await supabase.from("property_images").insert(
          imageUrls.map((url, index) => ({
            property_id: id,
            image_url: url,
            position: index,
          }))
        );
      }
    }

    return NextResponse.json({ id });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to update property";
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
      { error: "Supabase is not configured; deletion is unavailable in demo mode." },
      { status: 503 }
    );
  }

  const { id } = idParamSchema.parse(await context.params);
  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: routeLabel,
    startTime,
    supabase,
  });
  if (!auth.ok) return auth.response;

  const { data: existing, error: fetchError } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: "Property not found",
    });
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const role = await getUserRole(supabase, auth.user.id);
  const ownership = requireOwnership({
    request,
    route: routeLabel,
    startTime,
    resourceOwnerId: existing.owner_id,
    userId: auth.user.id,
    role,
    allowRoles: ["admin"],
  });
  if (!ownership.ok) return ownership.response;

  const { error } = await supabase.from("properties").delete().eq("id", id);

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

  return NextResponse.json({ id });
}
