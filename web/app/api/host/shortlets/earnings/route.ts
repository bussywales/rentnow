import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { listHostShortletEarningsTimeline } from "@/lib/shortlet/shortlet.server";

const routeLabel = "/api/host/shortlets/earnings";

function parseLimit(value: string | null) {
  if (!value) return 160;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 160;
  return Math.max(1, Math.min(240, Math.trunc(parsed)));
}

export type HostShortletEarningsRouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  requireRole: typeof requireRole;
  readActingAsFromRequest: typeof readActingAsFromRequest;
  hasActiveDelegation: typeof hasActiveDelegation;
  hasServiceRoleEnv?: typeof hasServiceRoleEnv;
  createServiceRoleClient?: typeof createServiceRoleClient;
  listHostShortletEarningsTimeline: typeof listHostShortletEarningsTimeline;
};

const defaultDeps: HostShortletEarningsRouteDeps = {
  hasServerSupabaseEnv,
  requireRole,
  readActingAsFromRequest,
  hasActiveDelegation,
  hasServiceRoleEnv,
  createServiceRoleClient,
  listHostShortletEarningsTimeline,
};

export async function getHostShortletEarningsResponse(
  request: NextRequest,
  deps: HostShortletEarningsRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  let ownerId = auth.user.id;
  if (auth.role === "agent") {
    const actingAs = deps.readActingAsFromRequest(request);
    if (actingAs && actingAs !== auth.user.id) {
      const allowed = await deps.hasActiveDelegation(auth.supabase, auth.user.id, actingAs);
      if (allowed) ownerId = actingAs;
    }
  }

  const limit = parseLimit(new URL(request.url).searchParams.get("limit"));
  const canUseServiceRole = !!deps.hasServiceRoleEnv?.() && !!deps.createServiceRoleClient;
  const shouldUseServiceRole = canUseServiceRole && ownerId !== auth.user.id;
  const client = shouldUseServiceRole
    ? (deps.createServiceRoleClient!() as unknown as SupabaseClient)
    : auth.supabase;

  try {
    const payload = await deps.listHostShortletEarningsTimeline({
      client,
      hostUserId: ownerId,
      limit,
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load host earnings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return getHostShortletEarningsResponse(request);
}
