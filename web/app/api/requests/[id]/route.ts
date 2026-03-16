import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole, requireUser } from "@/lib/authz";
import {
  PROPERTY_REQUEST_SELECT_COLUMNS,
  canViewPropertyRequest,
  mapPropertyRequestRecord,
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return getPropertyRequestDetailResponse(request, id);
}
