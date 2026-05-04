import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updateMarketOneOffPrice } from "@/lib/billing/market-pricing-control-plane-actions.server";

const routeLabel = "/api/admin/market-pricing/one-off-prices/[id]";

type AdminMarketPricingOneOffPriceRouteDeps = {
  createServerSupabaseClient?: typeof createServerSupabaseClient;
  requireRole?: typeof requireRole;
  updateMarketOneOffPrice?: typeof updateMarketOneOffPrice;
};

export async function patchAdminMarketPricingOneOffPriceResponse(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
  deps: AdminMarketPricingOneOffPriceRouteDeps = {}
) {
  const startTime = Date.now();
  const createServerSupabaseClientImpl =
    deps.createServerSupabaseClient ?? createServerSupabaseClient;
  const requireRoleImpl = deps.requireRole ?? requireRole;
  const updateMarketOneOffPriceImpl =
    deps.updateMarketOneOffPrice ?? updateMarketOneOffPrice;

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
  const result = await updateMarketOneOffPriceImpl({
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
  return patchAdminMarketPricingOneOffPriceResponse(request, context);
}
