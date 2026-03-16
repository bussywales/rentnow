import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole, requireUser } from "@/lib/authz";
import {
  PROPERTY_REQUEST_SELECT_COLUMNS,
  canSendPropertyRequestResponses,
  canViewPropertyRequest,
  mapPropertyRequestRecord,
  propertyRequestResponseCreateSchema,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";
import { createPropertyRequestResponse } from "@/lib/requests/property-request-responses.server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/requests/[id]/responses";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PropertyRequestResponsesRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  loadRequest: (input: {
    supabase: SupabaseClient;
    requestId: string;
  }) => Promise<{ data: PropertyRequestRecord | null; error: { message: string } | null }>;
  createResponse: typeof createPropertyRequestResponse;
  now: () => Date;
};

const defaultDeps: PropertyRequestResponsesRouteDeps = {
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
  createResponse: createPropertyRequestResponse,
  now: () => new Date(),
};

export async function postPropertyRequestResponse(
  request: NextRequest,
  requestId: string,
  deps: PropertyRequestResponsesRouteDeps = defaultDeps
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

  const parsed = propertyRequestResponseCreateSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await deps.loadRequest({ supabase, requestId });
  if (error) {
    return NextResponse.json({ error: "Unable to load request" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const propertyRequest = mapPropertyRequestRecord(data);
  const now = deps.now();
  if (!canViewPropertyRequest({ role, viewerUserId: auth.user.id, request: propertyRequest, now })) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (!canSendPropertyRequestResponses({ role, viewerUserId: auth.user.id, request: propertyRequest, now })) {
    return NextResponse.json(
      { error: "This request is not accepting responses." },
      { status: 409 }
    );
  }

  const result = await deps.createResponse({
    supabase,
    role,
    userId: auth.user.id,
    request: propertyRequest,
    payload: parsed.data,
    now,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        issues: result.issues,
        missingListingIds: result.missingListingIds,
        duplicateListingIds: result.duplicateListingIds,
      },
      { status: result.status }
    );
  }

  return NextResponse.json({ ok: true, responseId: result.responseId }, { status: 201 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return postPropertyRequestResponse(request, id);
}
