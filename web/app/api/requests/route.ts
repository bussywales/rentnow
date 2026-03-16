import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole, requireUser } from "@/lib/authz";
import type { UserRole } from "@/lib/types";
import {
  PROPERTY_REQUEST_DEFAULT_EXPIRY_DAYS,
  PROPERTY_REQUEST_SELECT_COLUMNS,
  canRoleCreatePropertyRequests,
  mapPropertyRequestRecord,
  propertyRequestCreateSchema,
  resolvePropertyRequestListScope,
  resolvePropertyRequestPublishMissingFields,
  type PropertyRequestCreateInput,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";

export const dynamic = "force-dynamic";

const routeLabel = "/api/requests";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PropertyRequestsRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  listRequests: (input: {
    supabase: SupabaseClient;
    role: UserRole;
    userId: string;
  }) => Promise<{ data: PropertyRequestRecord[] | null; error: { message: string } | null }>;
  insertRequest: (input: {
    supabase: SupabaseClient;
    userId: string;
    role: UserRole;
    payload: PropertyRequestCreateInput;
    now: Date;
  }) => Promise<{ data: PropertyRequestRecord | null; error: { message: string } | null }>;
  now: () => Date;
};

const defaultDeps: PropertyRequestsRouteDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireUser,
  getUserRole,
  listRequests: async ({ supabase, role, userId }) => {
    let query = supabase
      .from("property_requests")
      .select(PROPERTY_REQUEST_SELECT_COLUMNS)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (role === "tenant") {
      query = query.eq("owner_user_id", userId);
    } else if (role === "landlord" || role === "agent") {
      query = query.eq("status", "open");
    }

    const response = await query;
    return response as unknown as {
      data: PropertyRequestRecord[] | null;
      error: { message: string } | null;
    };
  },
  insertRequest: async ({ supabase, userId, role, payload, now }) => {
    const publishedAt = payload.status === "open" ? now.toISOString() : null;
    const expiresAt =
      payload.status === "open"
        ? new Date(now.getTime() + PROPERTY_REQUEST_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const insertRow = {
      owner_user_id: userId,
      owner_role: role,
      intent: payload.intent ?? "rent",
      market_code: payload.marketCode ?? "NG",
      currency_code: payload.currencyCode ?? "NGN",
      city: payload.city ?? null,
      area: payload.area ?? null,
      location_text: payload.locationText ?? null,
      budget_min: payload.budgetMin ?? null,
      budget_max: payload.budgetMax ?? null,
      property_type: payload.propertyType ?? null,
      bedrooms: payload.bedrooms ?? null,
      bathrooms: payload.bathrooms ?? null,
      furnished: payload.furnished ?? null,
      move_timeline: payload.moveTimeline ?? null,
      shortlet_duration: payload.shortletDuration ?? null,
      notes: payload.notes ?? null,
      status: payload.status,
      published_at: publishedAt,
      expires_at: expiresAt,
    };

    const response = await supabase
      .from("property_requests")
      .insert(insertRow)
      .select(PROPERTY_REQUEST_SELECT_COLUMNS)
      .single();

    return response as unknown as {
      data: PropertyRequestRecord | null;
      error: { message: string } | null;
    };
  },
  now: () => new Date(),
};

export async function getPropertyRequestsResponse(
  request: NextRequest,
  deps: PropertyRequestsRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(supabase, auth.user.id);
  const scope = resolvePropertyRequestListScope(role);
  if (!role || !scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await deps.listRequests({
    supabase,
    role,
    userId: auth.user.id,
  });
  if (error) {
    return NextResponse.json({ error: "Unable to load requests" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    scope,
    items: (data ?? []).map(mapPropertyRequestRecord),
  });
}

export async function postPropertyRequestsResponse(
  request: NextRequest,
  deps: PropertyRequestsRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(supabase, auth.user.id);
  if (!role || !canRoleCreatePropertyRequests(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const creatorRole: UserRole = role;

  const parsed = propertyRequestCreateSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.status === "open") {
    const missingFields = resolvePropertyRequestPublishMissingFields(parsed.data);
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

  const { data, error } = await deps.insertRequest({
    supabase,
    userId: auth.user.id,
    role: creatorRole,
    payload: parsed.data,
    now: deps.now(),
  });

  if (error || !data) {
    return NextResponse.json({ error: "Unable to create request" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: mapPropertyRequestRecord(data) }, { status: 201 });
}

export async function GET(request: NextRequest) {
  return getPropertyRequestsResponse(request);
}

export async function POST(request: NextRequest) {
  return postPropertyRequestsResponse(request);
}
