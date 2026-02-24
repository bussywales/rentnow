import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/support/requests/[id]/claim";

export const dynamic = "force-dynamic";

type SupportRequestRow = {
  id: string;
  status: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  resolved_at: string | null;
};

export type SupportRequestClaimDeps = {
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

const defaultDeps: SupportRequestClaimDeps = {
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

export async function postAdminSupportRequestClaimResponse(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: SupportRequestClaimDeps = defaultDeps
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

  const db = deps.hasServiceRoleEnv()
    ? (deps.createServiceRoleClient() as unknown as UntypedAdminClient)
    : ((await deps.createServerSupabaseClient()) as unknown as UntypedAdminClient);

  const existing = await deps.loadRequest(db, id);
  if (!existing) {
    return NextResponse.json({ error: "Support request not found." }, { status: 404 });
  }

  const currentStatus = String(existing.status || "new").toLowerCase();
  if (currentStatus === "resolved") {
    return NextResponse.json(
      { error: "Resolved requests cannot be claimed.", code: "resolved_request" },
      { status: 409 }
    );
  }

  if (existing.claimed_by && existing.claimed_by !== auth.user.id) {
    return NextResponse.json(
      {
        error: "Request is already claimed by another admin.",
        code: "already_claimed",
        claimedBy: existing.claimed_by,
      },
      { status: 409 }
    );
  }

  if (existing.claimed_by === auth.user.id) {
    return NextResponse.json({
      ok: true,
      alreadyClaimed: true,
      item: {
        id: existing.id,
        status: existing.status || "in_progress",
        claimedBy: existing.claimed_by,
        claimedAt: existing.claimed_at,
        resolvedAt: existing.resolved_at,
      },
    });
  }

  const nowIso = deps.now().toISOString();
  const updated = await deps.updateRequest(db, id, {
    claimed_by: auth.user.id,
    claimed_at: nowIso,
    status: currentStatus === "new" ? "in_progress" : currentStatus || "in_progress",
    resolved_at: currentStatus === "resolved" ? nowIso : null,
  });

  if (!updated) {
    return NextResponse.json({ error: "Unable to claim support request." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    alreadyClaimed: false,
    item: {
      id: updated.id,
      status: updated.status || "in_progress",
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
  return postAdminSupportRequestClaimResponse(request, context, defaultDeps);
}
