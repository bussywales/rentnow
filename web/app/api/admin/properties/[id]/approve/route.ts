import { NextResponse, type NextRequest } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { buildLiveApprovalUpdate } from "@/lib/properties/expiry";
import { getListingExpiryDays } from "@/lib/properties/expiry.server";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import { logApprovalAction, logPlanLimitHit } from "@/lib/observability";
import { enforceActiveListingLimit } from "@/lib/plan-enforcement";

export const dynamic = "force-dynamic";

export type AdminPropertyApproveDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getServerAuthUser: typeof getServerAuthUser;
  getListingExpiryDays: typeof getListingExpiryDays;
  logProductAnalyticsEvent: typeof logProductAnalyticsEvent;
  logApprovalAction: typeof logApprovalAction;
};

const defaultDeps: AdminPropertyApproveDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServiceRoleClient,
  getServerAuthUser,
  getListingExpiryDays,
  logProductAnalyticsEvent,
  logApprovalAction,
};

export async function postAdminPropertyApproveResponse(
  request: NextRequest,
  id: string,
  deps: AdminPropertyApproveDeps = defaultDeps
) {
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing", code: "SERVER_ERROR" }, { status: 503 });
  }
  const { supabase, user } = await deps.getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "NOT_AUTHENTICATED" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden", code: "NOT_ADMIN" }, { status: 403 });
  }

  const adminClient = deps.hasServiceRoleEnv() ? deps.createServiceRoleClient() : null;
  const lookupClient = adminClient ?? supabase;
  const { data: property } = await lookupClient
    .from("properties")
    .select("id,owner_id,is_active,status,city,country_code,listing_intent,listing_type")
    .eq("id", id)
    .maybeSingle();
  if (!property) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const willActivate = !property.is_active;
  if (willActivate) {
    const activeLimit = await enforceActiveListingLimit({
      supabase,
      ownerId: property.owner_id,
      serviceClient: adminClient,
      excludeId: id,
    });
    if (!activeLimit.ok) {
      if (activeLimit.usage.error) {
        return NextResponse.json({ error: activeLimit.usage.error }, { status: 500 });
      }
      logPlanLimitHit({
        request,
        route: "/api/admin/properties/[id]/approve",
        actorId: user.id,
        ownerId: property.owner_id,
        propertyId: id,
        planTier: activeLimit.planTier,
        maxListings: activeLimit.maxListings,
        activeCount: activeLimit.activeCount,
        source: activeLimit.usage.source,
      });
      return NextResponse.json(
        {
          error: activeLimit.error,
          code: activeLimit.code,
          maxListings: activeLimit.maxListings,
          activeCount: activeLimit.activeCount,
          planTier: activeLimit.planTier,
        },
        { status: 409 }
      );
    }
  }

  const now = new Date();
  const expiryDays = await deps.getListingExpiryDays();
  const updates = buildLiveApprovalUpdate({ now, expiryDays });
  const { error } = await supabase
    .from("properties")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to approve", code: "SERVER_ERROR" }, { status: 500 });
  }

  try {
    await supabase.from("admin_actions_log").insert({
      property_id: id,
      action_type: "approve",
      actor_id: user.id,
      payload_json: { status: "live" },
    });
  } catch {
    /* ignore logging failures */
  }

  await deps.logProductAnalyticsEvent({
    eventName: "listing_published_live",
    request,
    supabase,
    userId: user.id,
    userRole: "admin",
    properties: {
      market: property.country_code ?? undefined,
      role: "admin",
      intent: property.listing_intent ?? undefined,
      city: property.city ?? undefined,
      propertyType: property.listing_type ?? undefined,
      listingId: id,
      listingStatus: "live",
    },
  });

  deps.logApprovalAction({
    request,
    route: "/api/admin/properties/[id]/approve",
    actorId: user.id,
    propertyId: id,
    action: "approve",
    reasonProvided: false,
  });
  return NextResponse.json({ ok: true, id, status: "live" });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postAdminPropertyApproveResponse(request, id);
}
