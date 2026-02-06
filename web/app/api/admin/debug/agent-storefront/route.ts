import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import { resolveStorefrontPublicOutcome, type StorefrontPublicRow } from "@/lib/agents/agent-storefront";

export const dynamic = "force-dynamic";

const routeLabel = "/api/admin/debug/agent-storefront";

export type AdminAgentStorefrontDebugDeps = {
  hasServerSupabaseEnv: () => boolean;
  hasServiceRoleEnv: () => boolean;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
};

const defaultDeps: AdminAgentStorefrontDebugDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  requireRole,
};

export async function getAdminAgentStorefrontDebugResponse(
  request: NextRequest,
  deps: AdminAgentStorefrontDebugDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const client = deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : auth.supabase;

  const response = await client.rpc("get_agent_storefront_public", {
    input_slug: slug,
  });
  const row = (Array.isArray(response.data) ? response.data[0] : response.data) as
    | StorefrontPublicRow
    | null
    | undefined;
  const outcome = resolveStorefrontPublicOutcome(row ?? null);

  return NextResponse.json({
    ok: outcome.ok,
    reason: outcome.ok ? "OK" : outcome.reason,
    data: row ?? null,
    error: response.error ?? null,
    usedServiceRole: deps.hasServiceRoleEnv(),
  });
}

export async function GET(request: NextRequest) {
  return getAdminAgentStorefrontDebugResponse(request);
}
