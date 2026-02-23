import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getShortletsOpsSnapshot } from "@/lib/shortlet/ops.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/shortlets/ops";

export const dynamic = "force-dynamic";

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export type AdminShortletsOpsDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getShortletsOpsSnapshot: typeof getShortletsOpsSnapshot;
  now: () => Date;
};

const defaultDeps: AdminShortletsOpsDeps = {
  requireRole,
  hasServiceRoleEnv,
  createServiceRoleClient,
  getShortletsOpsSnapshot,
  now: () => new Date(),
};

export async function getAdminShortletsOpsResponse(
  request: NextRequest,
  deps: AdminShortletsOpsDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const now = deps.now();
  const client = deps.hasServiceRoleEnv()
    ? (deps.createServiceRoleClient() as unknown as UntypedAdminClient)
    : (auth.supabase as unknown as UntypedAdminClient);

  try {
    const snapshot = await deps.getShortletsOpsSnapshot({
      client,
      now,
    });
    return NextResponse.json({
      ok: true,
      route: routeLabel,
      asOf: toDateKey(now),
      ...snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load shortlets ops snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getAdminShortletsOpsResponse(request, defaultDeps);
}
