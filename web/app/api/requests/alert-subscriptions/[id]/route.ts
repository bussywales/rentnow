import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole, requireUser } from "@/lib/authz";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import {
  isPropertyRequestAlertEligibleRole,
  mapPropertyRequestAlertSubscriptionRecord,
  PROPERTY_REQUEST_ALERT_SUBSCRIPTION_SELECT_COLUMNS,
  type PropertyRequestAlertSubscriptionRecord,
} from "@/lib/requests/property-request-alert-subscriptions";

export const dynamic = "force-dynamic";

const routeLabel = "/api/requests/alert-subscriptions/[id]";

type RouteDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireUser: typeof requireUser;
  getUserRole: typeof getUserRole;
  logProductAnalyticsEvent: typeof logProductAnalyticsEvent;
};

const defaultDeps: RouteDeps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireUser,
  getUserRole,
  logProductAnalyticsEvent,
};

export async function deletePropertyRequestAlertSubscriptionResponse(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: RouteDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await deps.createServerSupabaseClient();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime, supabase });
  if (!auth.ok) return auth.response;

  const role = await deps.getUserRole(supabase, auth.user.id);
  if (!isPropertyRequestAlertEligibleRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("property_request_alert_subscriptions")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .select(PROPERTY_REQUEST_ALERT_SUBSCRIPTION_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Unable to remove request alert subscription." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Request alert subscription not found." }, { status: 404 });
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "Unable to read request alert subscription." }, { status: 500 });
  }

  const subscription = mapPropertyRequestAlertSubscriptionRecord(
    data as unknown as PropertyRequestAlertSubscriptionRecord
  );
  await deps.logProductAnalyticsEvent({
    eventName: "property_request_alert_subscription_deleted",
    request,
    supabase,
    userId: auth.user.id,
    userRole: role,
    properties: {
      market: subscription.marketCode,
      role,
      intent: subscription.intent ?? undefined,
      city: subscription.city,
      propertyType: subscription.propertyType,
      requestStatus: "inactive",
      surface: "request_alert_subscriptions",
      action: "deleted",
    },
  });

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return deletePropertyRequestAlertSubscriptionResponse(request, context);
}
