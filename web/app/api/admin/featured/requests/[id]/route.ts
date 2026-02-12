import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  parseFeaturedRequestDuration,
  validateFeaturedRequestTransition,
  type FeaturedRequestStatus,
} from "@/lib/featured/requests";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/featured/requests/[id]";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().max(1000).nullable().optional(),
  featuredRank: z.number().int().min(0).max(999).nullable().optional(),
  durationDays: z.union([z.literal(7), z.literal(30), z.null()]).optional(),
});

export type AdminFeaturedRequestRouteDeps = {
  hasServiceRoleEnv: () => boolean;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
};

const defaultDeps: AdminFeaturedRequestRouteDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  requireRole,
};

type FeaturedRequestRow = {
  id: string;
  status: FeaturedRequestStatus;
};

function parseAdminNote(value: string | null | undefined): string | null {
  const text = String(value || "").trim();
  return text ? text : null;
}

export async function patchAdminFeaturedRequestResponse(
  request: NextRequest,
  requestId: string,
  deps: AdminFeaturedRequestRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 422 });
  }

  const action = parsed.data.action;
  const adminNote = parseAdminNote(parsed.data.adminNote ?? null);
  const featuredRank = parsed.data.featuredRank ?? null;
  const durationDays = parseFeaturedRequestDuration(parsed.data.durationDays ?? null);

  if (action === "reject" && !adminNote) {
    return NextResponse.json({ error: "Reason is required for rejection." }, { status: 422 });
  }

  const client = deps.createServiceRoleClient();
  const { data: requestData, error: requestError } = await client
    .from("featured_requests")
    .select("id,status")
    .eq("id", requestId)
    .maybeSingle();

  const requestRow = (requestData as FeaturedRequestRow | null) ?? null;
  if (requestError || !requestRow) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const transition = validateFeaturedRequestTransition({
    currentStatus: requestRow.status,
    action,
  });
  if (!transition.ok) {
    return NextResponse.json({ error: transition.reason }, { status: transition.status });
  }

  const rpcPayload = {
    p_request_id: requestId,
    p_action: action,
    p_admin_user_id: auth.user.id,
    p_admin_note: adminNote,
    p_duration_days: durationDays,
    p_featured_rank: action === "approve" ? featuredRank : null,
  };

  const rpcClient = client as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc("admin_resolve_featured_request", rpcPayload);

  if (error) {
    const message = error.message || "Unable to process featured request.";
    if (message.includes("REQUEST_ALREADY_DECIDED")) {
      return NextResponse.json({ error: "Only pending requests can be approved or rejected." }, { status: 409 });
    }
    if (message.includes("DEMO_PROPERTY_BLOCKED")) {
      return NextResponse.json({ error: "Demo listings can't be featured." }, { status: 409 });
    }
    if (message.includes("INVALID_DURATION")) {
      return NextResponse.json({ error: "Duration must be 7, 30, or no expiry." }, { status: 422 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : null;
  return NextResponse.json({ ok: true, request: row });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return patchAdminFeaturedRequestResponse(request, id);
}
