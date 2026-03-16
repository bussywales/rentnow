import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole, requireUser } from "@/lib/authz";
import {
  PROPERTY_REQUEST_SELECT_COLUMNS,
  canOwnerWritePropertyRequestStatus,
  canViewPropertyRequest,
  mapPropertyRequestRecord,
  propertyRequestUpdateSchema,
  resolvePropertyRequestLifecycleDates,
  resolvePropertyRequestPublishMissingFields,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";

export const dynamic = "force-dynamic";

const routeLabel = "/api/requests/[id]";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PropertyRequestDetailRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  loadRequest: (input: {
    supabase: SupabaseClient;
    requestId: string;
  }) => Promise<{ data: PropertyRequestRecord | null; error: { message: string } | null }>;
  updateRequest: (input: {
    supabase: SupabaseClient;
    requestId: string;
    updates: Record<string, unknown>;
  }) => Promise<{ data: PropertyRequestRecord | null; error: { message: string } | null }>;
  now: () => Date;
};

const defaultDeps: PropertyRequestDetailRouteDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireUser,
  getUserRole,
  loadRequest: async ({ supabase, requestId }) => {
    const response = await supabase
      .from("property_requests")
      .select(PROPERTY_REQUEST_SELECT_COLUMNS)
      .eq("id", requestId)
      .maybeSingle();

    return response as unknown as {
      data: PropertyRequestRecord | null;
      error: { message: string } | null;
    };
  },
  updateRequest: async ({ supabase, requestId, updates }) => {
    const response = await supabase
      .from("property_requests")
      .update(updates)
      .eq("id", requestId)
      .select(PROPERTY_REQUEST_SELECT_COLUMNS)
      .single();

    return response as unknown as {
      data: PropertyRequestRecord | null;
      error: { message: string } | null;
    };
  },
  now: () => new Date(),
};

export async function getPropertyRequestDetailResponse(
  request: NextRequest,
  requestId: string,
  deps: PropertyRequestDetailRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(supabase, auth.user.id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await deps.loadRequest({ supabase, requestId });
  if (error) {
    return NextResponse.json({ error: "Unable to load request" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const item = mapPropertyRequestRecord(data);
  if (!canViewPropertyRequest({ role, viewerUserId: auth.user.id, request: item })) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    item,
    viewerCanEdit: role === "admin" || item.ownerUserId === auth.user.id,
  });
}

export async function patchPropertyRequestDetailResponse(
  request: NextRequest,
  requestId: string,
  deps: PropertyRequestDetailRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(supabase, auth.user.id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await deps.loadRequest({ supabase, requestId });
  if (error) {
    return NextResponse.json({ error: "Unable to load request" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const existing = mapPropertyRequestRecord(data);
  const viewerCanEdit = role === "admin" || existing.ownerUserId === auth.user.id;
  if (!viewerCanEdit) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const parsed = propertyRequestUpdateSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const getPatchedValue = <T,>(key: keyof typeof parsed.data, currentValue: T): T => {
    if (Object.prototype.hasOwnProperty.call(parsed.data, key)) {
      return parsed.data[key] as T;
    }
    return currentValue;
  };

  const nextStatus = parsed.data.status ?? existing.status;
  if (!canOwnerWritePropertyRequestStatus(nextStatus)) {
    return NextResponse.json({ error: "Unsupported request status" }, { status: 400 });
  }
  if (nextStatus === "closed" && existing.status === "draft") {
    return NextResponse.json(
      { error: "Draft requests can be saved or published before they are closed." },
      { status: 400 }
    );
  }

  const merged = {
    intent: getPatchedValue("intent", existing.intent),
    marketCode: getPatchedValue("marketCode", existing.marketCode),
    currencyCode: getPatchedValue("currencyCode", existing.currencyCode),
    city: getPatchedValue("city", existing.city),
    area: getPatchedValue("area", existing.area),
    locationText: getPatchedValue("locationText", existing.locationText),
    budgetMin: getPatchedValue("budgetMin", existing.budgetMin),
    budgetMax: getPatchedValue("budgetMax", existing.budgetMax),
    propertyType: getPatchedValue("propertyType", existing.propertyType),
    bedrooms: getPatchedValue("bedrooms", existing.bedrooms),
    bathrooms: getPatchedValue("bathrooms", existing.bathrooms),
    furnished: getPatchedValue("furnished", existing.furnished),
    moveTimeline: getPatchedValue("moveTimeline", existing.moveTimeline),
    shortletDuration: getPatchedValue("shortletDuration", existing.shortletDuration),
    notes: getPatchedValue("notes", existing.notes),
    status: nextStatus,
  };

  if (nextStatus === "open") {
    const missingFields = resolvePropertyRequestPublishMissingFields(merged);
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Open requests need more detail before publish.",
          code: "REQUEST_PUBLISH_FIELDS_MISSING",
          missingFields,
        },
        { status: 400 }
      );
    }
  }

  const lifecycle = resolvePropertyRequestLifecycleDates({
    nextStatus,
    currentPublishedAt: existing.publishedAt,
    currentExpiresAt: existing.expiresAt,
    now: deps.now(),
  });

  const { data: updated, error: updateError } = await deps.updateRequest({
    supabase,
    requestId,
    updates: {
      intent: merged.intent,
      market_code: merged.marketCode,
      currency_code: merged.currencyCode,
      city: merged.city,
      area: merged.area,
      location_text: merged.locationText,
      budget_min: merged.budgetMin,
      budget_max: merged.budgetMax,
      property_type: merged.propertyType,
      bedrooms: merged.bedrooms,
      bathrooms: merged.bathrooms,
      furnished: merged.furnished,
      move_timeline: merged.moveTimeline,
      shortlet_duration: merged.shortletDuration,
      notes: merged.notes,
      status: nextStatus,
      published_at: lifecycle.publishedAt,
      expires_at: lifecycle.expiresAt,
    },
  });

  if (updateError || !updated) {
    return NextResponse.json({ error: "Unable to update request" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    item: mapPropertyRequestRecord(updated),
    viewerCanEdit: true,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return getPropertyRequestDetailResponse(request, id);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return patchPropertyRequestDetailResponse(request, id);
}
