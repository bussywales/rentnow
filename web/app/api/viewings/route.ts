import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnership, requireRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import {
  handleViewingRequest,
  validatePreferredTimes,
} from "@/app/api/viewings/request/route";

const routeLabel = "/api/viewings";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "accepted", "declined", "cancelled"]),
});

export function parseLegacyPayload(body: unknown, timeZone = "Africa/Lagos") {
  const payload = body as Record<string, unknown>;
  const propertyId = payload.propertyId ?? payload.property_id;
  const preferredTimes =
    payload.preferredTimes ??
    payload.preferred_times ??
    (payload.preferred_date ? [`${payload.preferred_date}T12:00:00Z`] : []);
  const messageRaw = (payload.message ?? payload.note) as string | null | undefined;

  const propertyIdResult = z.string().uuid().safeParse(propertyId);
  if (!propertyIdResult.success) {
    throw new Error("Invalid property id");
  }

  if (!Array.isArray(preferredTimes) || preferredTimes.length === 0) {
    throw new Error("Preferred times must include 1 to 3 entries");
  }

  const validatedTimes = validatePreferredTimes(
    preferredTimes.map((value) => String(value)),
    timeZone
  );
  const trimmed = typeof messageRaw === "string" ? messageRaw.trim() : null;

  return {
    propertyId: propertyIdResult.data,
    preferredTimes: validatedTimes,
    message: trimmed ? trimmed.slice(0, 1000) : null,
  };
}

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
    roles: ["tenant", "landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const supabase = auth.supabase;
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("property_id");
  const tenantId = searchParams.get("tenant_id");

  let query = supabase
    .from("viewing_requests")
    .select("*, properties(id, owner_id, title)")
    .order("created_at", { ascending: false });

  if (auth.role === "tenant") {
    query = query.eq("tenant_id", auth.user.id);
    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }
  } else if (auth.role === "admin") {
    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }
  } else {
    query = query.eq("properties.owner_id", auth.user.id);
    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }
  }

  const { data, error } = await query;
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

  return NextResponse.json({ viewings: data || [] });
}

export async function POST(request: Request) {
  return handleViewingRequest(request, "legacy-alias");
}

export async function PATCH(request: Request) {
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
      { error: "Supabase is not configured; viewing updates are unavailable." },
      { status: 503 }
    );
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant", "landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const supabase = auth.supabase;
  const body = await request.json();
  const payload = updateSchema.parse(body);

  const { data: existing, error: fetchError } = await supabase
    .from("viewing_requests")
    .select("id, tenant_id, property_id")
    .eq("id", payload.id)
    .maybeSingle();

  if (fetchError || !existing) {
    logFailure({
      request,
      route: routeLabel,
      status: 404,
      startTime,
      error: "Viewing request not found",
    });
    return NextResponse.json({ error: "Viewing request not found" }, { status: 404 });
  }

  if (auth.role === "tenant") {
    if (payload.status !== "cancelled") {
      logFailure({
        request,
        route: routeLabel,
        status: 403,
        startTime,
        error: "Tenant can only cancel",
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const ownership = requireOwnership({
      request,
      route: routeLabel,
      startTime,
      resourceOwnerId: existing.tenant_id,
      userId: auth.user.id,
      role: auth.role,
      allowRoles: ["admin"],
    });
    if (!ownership.ok) return ownership.response;
  } else if (auth.role !== "admin") {
    if (!["accepted", "declined"].includes(payload.status)) {
      logFailure({
        request,
        route: routeLabel,
        status: 403,
        startTime,
        error: "Owner status not allowed",
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("owner_id")
      .eq("id", existing.property_id)
      .maybeSingle();

    if (propertyError || !property) {
      logFailure({
        request,
        route: routeLabel,
        status: 404,
        startTime,
        error: "Property not found",
      });
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const ownership = requireOwnership({
      request,
      route: routeLabel,
      startTime,
      resourceOwnerId: property.owner_id,
      userId: auth.user.id,
      role: auth.role,
      allowRoles: ["admin"],
    });
    if (!ownership.ok) return ownership.response;
  }

  const { data, error } = await supabase
    .from("viewing_requests")
    .update({ status: payload.status })
    .eq("id", payload.id)
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
}
