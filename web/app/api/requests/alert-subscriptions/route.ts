import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole, requireUser } from "@/lib/authz";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import {
  arePropertyRequestAlertSubscriptionCriteriaEqual,
  isPropertyRequestAlertEligibleRole,
  mapPropertyRequestAlertSubscriptionRecord,
  normalizePropertyRequestAlertSubscriptionInput,
  propertyRequestAlertSubscriptionCreateSchema,
  PROPERTY_REQUEST_ALERT_SUBSCRIPTION_SELECT_COLUMNS,
  type PropertyRequestAlertSubscriptionRecord,
} from "@/lib/requests/property-request-alert-subscriptions";

export const dynamic = "force-dynamic";

const routeLabel = "/api/requests/alert-subscriptions";

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

function isSubscriptionRecordList(value: unknown): value is PropertyRequestAlertSubscriptionRecord[] {
  return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null);
}

export async function getPropertyRequestAlertSubscriptionsResponse(
  request: NextRequest,
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
    return NextResponse.json({ ok: true, items: [], eligible: false });
  }

  const { data, error } = await supabase
    .from("property_request_alert_subscriptions")
    .select(PROPERTY_REQUEST_ALERT_SUBSCRIPTION_SELECT_COLUMNS)
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load request alert subscriptions." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    eligible: true,
    items: isSubscriptionRecordList(data)
      ? data.map(mapPropertyRequestAlertSubscriptionRecord)
      : [],
  });
}

export async function postPropertyRequestAlertSubscriptionsResponse(
  request: NextRequest,
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

  const parsed = propertyRequestAlertSubscriptionCreateSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request alert subscription payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const normalized = normalizePropertyRequestAlertSubscriptionInput(parsed.data);
  const { data: existingRows, error: existingError } = await supabase
    .from("property_request_alert_subscriptions")
    .select(PROPERTY_REQUEST_ALERT_SUBSCRIPTION_SELECT_COLUMNS)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (existingError) {
    return NextResponse.json({ error: "Unable to load existing subscriptions." }, { status: 500 });
  }

  const existing = isSubscriptionRecordList(existingRows)
    ? existingRows.map(mapPropertyRequestAlertSubscriptionRecord)
    : [];
  const duplicate = existing.find((subscription) =>
    arePropertyRequestAlertSubscriptionCriteriaEqual(
      {
        role: subscription.role,
        marketCode: subscription.marketCode,
        intent: subscription.intent,
        propertyType: subscription.propertyType,
        city: subscription.city,
        bedroomsMin: subscription.bedroomsMin,
      },
      {
        role,
        marketCode: normalized.marketCode,
        intent: normalized.intent,
        propertyType: normalized.propertyType,
        city: normalized.city,
        bedroomsMin: normalized.bedroomsMin,
      }
    )
  );

  if (duplicate?.isActive) {
    return NextResponse.json({ ok: true, subscription: duplicate, created: false });
  }

  const writePayload = {
    user_id: auth.user.id,
    role,
    market_code: normalized.marketCode,
    intent: normalized.intent,
    property_type: normalized.propertyType,
    city: normalized.city,
    bedrooms_min: normalized.bedroomsMin,
    is_active: true,
  };

  const response = duplicate
    ? await supabase
        .from("property_request_alert_subscriptions")
        .update(writePayload)
        .eq("id", duplicate.id)
        .eq("user_id", auth.user.id)
        .select(PROPERTY_REQUEST_ALERT_SUBSCRIPTION_SELECT_COLUMNS)
        .single()
    : await supabase
        .from("property_request_alert_subscriptions")
        .insert(writePayload)
        .select(PROPERTY_REQUEST_ALERT_SUBSCRIPTION_SELECT_COLUMNS)
        .single();

  const { data, error } = response as {
    data: PropertyRequestAlertSubscriptionRecord | null;
    error: { message?: string | null } | null;
  };

  if (error || !data) {
    return NextResponse.json({ error: "Unable to save request alert subscription." }, { status: 500 });
  }

  const subscription = mapPropertyRequestAlertSubscriptionRecord(data);
  await deps.logProductAnalyticsEvent({
    eventName: "property_request_alert_subscription_created",
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
      requestStatus: subscription.isActive ? "active" : "inactive",
      surface: "request_alert_subscriptions",
      action: duplicate ? "reactivated" : "created",
    },
  });

  return NextResponse.json({ ok: true, subscription, created: true }, { status: duplicate ? 200 : 201 });
}

export async function GET(request: NextRequest) {
  return getPropertyRequestAlertSubscriptionsResponse(request);
}

export async function POST(request: NextRequest) {
  return postPropertyRequestAlertSubscriptionsResponse(request);
}
