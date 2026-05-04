import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updateMarketBillingPolicy } from "@/lib/billing/market-pricing-control-plane-actions.server";

const routeLabel = "/api/admin/market-pricing/policies/[id]";

type AdminMarketPricingPolicyRouteDeps = {
  createServerSupabaseClient?: typeof createServerSupabaseClient;
  requireRole?: typeof requireRole;
  updateMarketBillingPolicy?: typeof updateMarketBillingPolicy;
};

export async function patchAdminMarketPricingPolicyResponse(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
  deps: AdminMarketPricingPolicyRouteDeps = {}
) {
  const startTime = Date.now();
  const createServerSupabaseClientImpl =
    deps.createServerSupabaseClient ?? createServerSupabaseClient;
  const requireRoleImpl = deps.requireRole ?? requireRole;
  const updateMarketBillingPolicyImpl =
    deps.updateMarketBillingPolicy ?? updateMarketBillingPolicy;

  const supabase = await createServerSupabaseClientImpl();
  const auth = await requireRoleImpl({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
    supabase,
  });
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const body = await request.json().catch(() => null);
  const result = await updateMarketBillingPolicyImpl({
    client: auth.supabase as never,
    actorId: auth.user.id,
    id: params.id,
    payload: body,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, row: result.row });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  return patchAdminMarketPricingPolicyResponse(request, context);
}
