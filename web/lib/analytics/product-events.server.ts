import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionKeyFromRequest, getSessionKeyFromUser } from "@/lib/analytics/session.server";
import {
  getProductAnalyticsEventFamily,
  normalizeProductAnalyticsProperties,
  type ProductAnalyticsEventName,
  type ProductAnalyticsEventProperties,
} from "@/lib/analytics/product-events";
import { readAnalyticsAttributionFromCookieHeader } from "@/lib/analytics/acquisition";

type ProductAnalyticsInsertRow = {
  event_name: ProductAnalyticsEventName;
  event_family: string;
  page_path: string | null;
  session_key: string | null;
  user_id: string | null;
  user_role: string | null;
  market: string | null;
  intent: string | null;
  city: string | null;
  area: string | null;
  property_type: string | null;
  listing_id: string | null;
  listing_status: string | null;
  plan_tier: string | null;
  cadence: string | null;
  billing_source: string | null;
  currency: string | null;
  amount: number | null;
  provider: string | null;
  provider_subscription_id: string | null;
  request_status: string | null;
  share_channel: string | null;
  search_source: string | null;
  results_count: number | null;
  filter_count: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_path: string | null;
  properties: Record<string, unknown>;
};

export type LogProductAnalyticsEventInput = {
  eventName: ProductAnalyticsEventName;
  properties?: ProductAnalyticsEventProperties | Record<string, unknown> | null;
  request?: Request;
  supabase?: SupabaseClient;
  userId?: string | null;
  userRole?: string | null;
};

function buildInsertRow(input: LogProductAnalyticsEventInput): ProductAnalyticsInsertRow {
  const properties = normalizeProductAnalyticsProperties(input.properties);
  const attribution = input.request
    ? readAnalyticsAttributionFromCookieHeader(input.request.headers.get("cookie"))
    : null;

  return {
    event_name: input.eventName,
    event_family: getProductAnalyticsEventFamily(input.eventName),
    page_path: properties.pagePath ?? null,
    session_key: input.request
      ? getSessionKeyFromRequest(input.request)
      : getSessionKeyFromUser(input.userId ?? null),
    user_id: input.userId ?? null,
    user_role: input.userRole ?? properties.role ?? null,
    market: properties.market ?? null,
    intent: properties.intent ?? null,
    city: properties.city ?? null,
    area: properties.area ?? null,
    property_type: properties.propertyType ?? null,
    listing_id: properties.listingId ?? null,
    listing_status: properties.listingStatus ?? null,
    plan_tier: properties.planTier ?? null,
    cadence: properties.cadence ?? null,
    billing_source: properties.billingSource ?? null,
    currency: properties.currency ?? null,
    amount: typeof properties.amount === "number" ? properties.amount : null,
    provider: properties.provider ?? null,
    provider_subscription_id: properties.providerSubscriptionId ?? null,
    request_status: properties.requestStatus ?? null,
    share_channel: properties.shareChannel ?? null,
    search_source: properties.searchSource ?? null,
    results_count: typeof properties.resultsCount === "number" ? properties.resultsCount : null,
    filter_count: typeof properties.filterCount === "number" ? properties.filterCount : null,
    utm_source: attribution?.utm_source ?? null,
    utm_medium: attribution?.utm_medium ?? null,
    utm_campaign: attribution?.utm_campaign ?? null,
    utm_content: attribution?.utm_content ?? null,
    utm_term: attribution?.utm_term ?? null,
    landing_path: attribution?.landing_path ?? null,
    properties,
  };
}

export async function logProductAnalyticsEvent(input: LogProductAnalyticsEventInput) {
  const row = buildInsertRow(input);

  try {
    const supabase = input.supabase
      ? input.supabase
      : hasServiceRoleEnv()
        ? createServiceRoleClient()
        : await createServerSupabaseClient();

    const query = typeof supabase.from === "function" ? supabase.from("product_analytics_events") : null;
    if (!query || typeof (query as { insert?: unknown }).insert !== "function") {
      return { ok: false as const, error: "product analytics sink unavailable" };
    }

    const { error } = await query.insert(row);
    if (error) {
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "product analytics sink unavailable",
    };
  }
}
