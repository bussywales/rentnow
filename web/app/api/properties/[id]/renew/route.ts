import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { logPlanLimitHit } from "@/lib/observability";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { buildRenewalUpdate, isListingExpired } from "@/lib/properties/expiry";
import { getListingExpiryDays } from "@/lib/properties/expiry.server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({
    request,
    route: `/api/properties/${id}/renew`,
    startTime,
    supabase,
  });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(supabase, auth.user.id);
  const access = getListingAccessResult(role, true);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status }
    );
  }

  const actingAs = readActingAsFromRequest(request);
  let ownerId = auth.user.id;
  if (role === "agent" && actingAs && actingAs !== auth.user.id) {
    const allowed = await hasActiveDelegation(supabase, auth.user.id, actingAs);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    ownerId = actingAs;
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id, status, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (property.owner_id !== ownerId && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isListingExpired(property)) {
    return NextResponse.json({ error: "Listing is not expired" }, { status: 400 });
  }

  if (role !== "admin") {
    const serviceClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
    const usage = await getPlanUsage({
      supabase,
      ownerId: property.owner_id,
      serviceClient,
      excludeId: id,
    });
    if (usage.error) {
      return NextResponse.json({ error: usage.error }, { status: 500 });
    }
    if (usage.activeCount >= usage.plan.maxListings) {
      logPlanLimitHit({
        request,
        route: `/api/properties/${id}/renew`,
        actorId: auth.user.id,
        ownerId: property.owner_id,
        propertyId: id,
        planTier: usage.plan.tier,
        maxListings: usage.plan.maxListings,
        activeCount: usage.activeCount,
        source: usage.source,
      });
      return NextResponse.json(
        {
          error: "Plan limit reached",
          code: "plan_limit_reached",
          maxListings: usage.plan.maxListings,
          activeCount: usage.activeCount,
          planTier: usage.plan.tier,
        },
        { status: 409 }
      );
    }
  }

  const expiryDays = await getListingExpiryDays();
  const updates = buildRenewalUpdate({ now: new Date(), expiryDays });
  const { error } = await supabase.from("properties").update(updates).eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to renew" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "live" });
}
