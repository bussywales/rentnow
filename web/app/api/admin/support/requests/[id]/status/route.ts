import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/support/requests/[id]/status";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  status: z.enum(["new", "in_progress", "resolved", "closed"]),
});

type SupportRequestRow = {
  id: string;
  status: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  resolved_at: string | null;
};

export type SupportRequestStatusDeps = {
  requireRole: typeof requireRole;
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  now: () => Date;
  loadRequest: (client: UntypedAdminClient, id: string) => Promise<SupportRequestRow | null>;
  updateRequest: (
    client: UntypedAdminClient,
    id: string,
    payload: Record<string, unknown>
  ) => Promise<SupportRequestRow | null>;
};

const defaultDeps: SupportRequestStatusDeps = {
  requireRole,
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  now: () => new Date(),
  async loadRequest(client, id) {
    const { data, error } = await client
      .from<SupportRequestRow>("support_requests")
      .select("id,status,claimed_by,claimed_at,resolved_at")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  },
  async updateRequest(client, id, payload) {
    const { data, error } = await client
      .from<SupportRequestRow>("support_requests")
      .update(payload)
      .eq("id", id)
      .select("id,status,claimed_by,claimed_at,resolved_at")
      .maybeSingle();
    if (error || !data) return null;
    return data;
  },
};

function buildStatusUpdatePayload(
  targetStatus: "new" | "in_progress" | "resolved" | "closed",
  input: { nowIso: string; adminUserId: string; row: SupportRequestRow }
) {
  if (targetStatus === "new") {
    return {
      status: "new",
      claimed_by: null,
      claimed_at: null,
      resolved_at: null,
    };
  }

  if (targetStatus === "in_progress") {
    return {
      status: "in_progress",
      claimed_by: input.row.claimed_by || input.adminUserId,
      claimed_at: input.row.claimed_at || input.nowIso,
      resolved_at: null,
    };
  }

  if (targetStatus === "closed") {
    return {
      status: "closed",
      claimed_by: input.row.claimed_by || input.adminUserId,
      claimed_at: input.row.claimed_at || input.nowIso,
      resolved_at: input.row.resolved_at || input.nowIso,
    };
  }

  return {
    status: "resolved",
    claimed_by: input.row.claimed_by || input.adminUserId,
    claimed_at: input.row.claimed_at || input.nowIso,
    resolved_at: input.nowIso,
  };
}

export async function postAdminSupportRequestStatusResponse(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: SupportRequestStatusDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Support request id is required." }, { status: 422 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 422 });
  }

  const db = deps.hasServiceRoleEnv()
    ? (deps.createServiceRoleClient() as unknown as UntypedAdminClient)
    : ((await deps.createServerSupabaseClient()) as unknown as UntypedAdminClient);

  const existing = await deps.loadRequest(db, id);
  if (!existing) {
    return NextResponse.json({ error: "Support request not found." }, { status: 404 });
  }

  const nowIso = deps.now().toISOString();
  const payload = buildStatusUpdatePayload(parsed.data.status, {
    nowIso,
    adminUserId: auth.user.id,
    row: existing,
  });
  const updated = await deps.updateRequest(db, id, payload);

  if (!updated) {
    return NextResponse.json({ error: "Unable to update support request status." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    item: {
      id: updated.id,
      status: updated.status || parsed.data.status,
      claimedBy: updated.claimed_by,
      claimedAt: updated.claimed_at,
      resolvedAt: updated.resolved_at,
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return postAdminSupportRequestStatusResponse(request, context, defaultDeps);
}

export { buildStatusUpdatePayload };
