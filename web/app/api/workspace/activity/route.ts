import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { getWorkspaceActivityFeed } from "@/lib/activity/workspace-activity.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/workspace/activity";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).optional(),
});

export const dynamic = "force-dynamic";

export type WorkspaceActivityRouteDeps = {
  requireRole: typeof requireRole;
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getWorkspaceActivityFeed: typeof getWorkspaceActivityFeed;
};

const defaultDeps: WorkspaceActivityRouteDeps = {
  requireRole,
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServiceRoleClient,
  getWorkspaceActivityFeed,
};

export async function getWorkspaceActivityResponse(
  request: NextRequest,
  deps: WorkspaceActivityRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  const parsed = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });
  const limit = parsed.success ? parsed.data.limit ?? 12 : 12;

  const client = deps.hasServiceRoleEnv()
    ? (deps.createServiceRoleClient() as unknown as UntypedAdminClient)
    : (auth.supabase as unknown as UntypedAdminClient);
  const activityRole =
    auth.role === "agent" || auth.role === "landlord" || auth.role === "admin"
      ? auth.role
      : null;
  if (!activityRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const items = await deps.getWorkspaceActivityFeed({
      client,
      userId: auth.user.id,
      role: activityRole,
      limit,
    });

    return NextResponse.json({
      ok: true,
      items,
      count: items.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load activity feed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getWorkspaceActivityResponse(request, defaultDeps);
}
