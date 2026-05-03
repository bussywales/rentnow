import { getSiteUrl } from "@/lib/env";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { buildPropertyRequestPublishedAlertEmail } from "@/lib/email/templates/property-request-published-alert";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import {
  doesPropertyRequestMatchAlertSubscription,
  mapPropertyRequestAlertSubscriptionRecord,
  type PropertyRequestAlertSubscription,
  type PropertyRequestAlertSubscriptionRecord,
} from "@/lib/requests/property-request-alert-subscriptions";
import {
  getPropertyRequestDisplayTitle,
  getPropertyRequestIntentLabel,
  getPropertyRequestLocationSummary,
  getPropertyRequestMoveTimelineLabel,
  type PropertyRequest,
} from "@/lib/requests/property-requests";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type ProfileAlertPreferenceRow = {
  id: string;
  role: string | null;
  property_request_alerts_enabled?: boolean | null;
};

type DeliveryRow = {
  subscription_id: string;
};

type EmailLookupClient = {
  auth: {
    admin: {
      getUserById: (
        userId: string
      ) => Promise<{ data?: { user?: { email?: string | null } | null } | null }>;
    };
  };
};

type QueryResultLike<T> = PromiseLike<{
  data: T[] | null;
  error: { message?: string | null } | null;
}>;

type QueryBuilderLike<T> = QueryResultLike<T> & {
  eq: (column: string, value: string | boolean) => QueryBuilderLike<T>;
  in: (column: string, values: string[]) => QueryBuilderLike<T>;
};

type QueryClientLike = {
  from: <T = never>(table: string) => {
    select: (columns: string) => QueryBuilderLike<T>;
    insert?: (
      row: Record<string, unknown> | Array<Record<string, unknown>>
    ) => Promise<{ error: { message?: string | null; code?: string | null } | null }>;
  };
};

type DeliveryStatus = "sent" | "failed";

export type PropertyRequestPublishedAlertDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getSiteUrl: typeof getSiteUrl;
  loadActiveSubscriptions: (
    client: QueryClientLike,
    request: PropertyRequest
  ) => Promise<PropertyRequestAlertSubscription[]>;
  loadProfileAlertPreferences: (
    client: QueryClientLike,
    userIds: string[]
  ) => Promise<ProfileAlertPreferenceRow[]>;
  loadExistingDeliveries: (
    client: QueryClientLike,
    requestId: string,
    subscriptionIds: string[]
  ) => Promise<Set<string>>;
  recordDelivery: (
    client: QueryClientLike,
    input: {
      subscriptionId: string;
      requestId: string;
      userId: string;
      deliveryStatus: DeliveryStatus;
    }
  ) => Promise<void>;
  getUserEmail: (client: EmailLookupClient, userId: string) => Promise<string | null>;
  sendEmail: (input: { to: string; subject: string; html: string }) => Promise<{ ok: boolean; error?: string }>;
  logSubscriberAlertSent: (input: {
    userId: string;
    role: string | null;
    request: PropertyRequest;
    subscription: PropertyRequestAlertSubscription;
  }) => Promise<void>;
};

export async function recordPropertyRequestAlertDelivery(
  client: QueryClientLike,
  input: {
    subscriptionId: string;
    requestId: string;
    userId: string;
    deliveryStatus: DeliveryStatus;
  }
) {
  const deliveryTable = client.from("property_request_alert_deliveries");
  const insert = deliveryTable.insert;
  if (!insert) return;
  const { error } = await insert.call(deliveryTable, {
    subscription_id: input.subscriptionId,
    request_id: input.requestId,
    user_id: input.userId,
    channel: "email",
    delivery_status: input.deliveryStatus,
  });
  if (error && error.code !== "23505") {
    console.warn("[property-request-alerts] delivery_log_failed", {
      requestId: input.requestId,
      subscriptionId: input.subscriptionId,
      message: error.message || "insert_failed",
    });
  }
}

const defaultDeps: PropertyRequestPublishedAlertDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  getSiteUrl,
  async loadActiveSubscriptions(client, request) {
    const { data } = await client
      .from<PropertyRequestAlertSubscriptionRecord>("property_request_alert_subscriptions")
      .select(
        "id, user_id, role, market_code, intent, property_type, city, bedrooms_min, is_active, created_at, updated_at"
      )
      .eq("is_active", true)
      .eq("market_code", request.marketCode);

    return ((Array.isArray(data) ? data : []) as PropertyRequestAlertSubscriptionRecord[])
      .map(mapPropertyRequestAlertSubscriptionRecord)
      .filter((subscription) => doesPropertyRequestMatchAlertSubscription(request, subscription));
  },
  async loadProfileAlertPreferences(client, userIds) {
    if (userIds.length === 0) return [];
    const { data } = await client
      .from<ProfileAlertPreferenceRow>("profiles")
      .select("id, role, property_request_alerts_enabled")
      .in("id", userIds);
    return (Array.isArray(data) ? data : []) as ProfileAlertPreferenceRow[];
  },
  async loadExistingDeliveries(client, requestId, subscriptionIds) {
    if (subscriptionIds.length === 0) return new Set<string>();
    const { data } = await client
      .from<DeliveryRow>("property_request_alert_deliveries")
      .select("subscription_id")
      .eq("request_id", requestId)
      .in("subscription_id", subscriptionIds);

    return new Set(
      ((Array.isArray(data) ? data : []) as DeliveryRow[])
        .map((row) => row.subscription_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    );
  },
  recordDelivery: recordPropertyRequestAlertDelivery,
  async getUserEmail(client, userId) {
    const response = await client.auth.admin.getUserById(userId);
    const email = response.data?.user?.email ?? null;
    const normalized = String(email || "").trim();
    return normalized || null;
  },
  async sendEmail(input) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { ok: false, error: "resend_not_configured" };

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "PropatyHub <no-reply@propatyhub.com>",
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    }).catch(() => null);

    if (!response) return { ok: false, error: "resend_request_failed" };
    if (!response.ok) return { ok: false, error: `resend_${response.status}` };
    return { ok: true };
  },
  async logSubscriberAlertSent(input) {
    await logProductAnalyticsEvent({
      eventName: "property_request_subscriber_alert_sent",
      userId: input.userId,
      userRole: input.role,
      properties: {
        market: input.request.marketCode,
        role: input.role ?? undefined,
        intent: input.request.intent,
        city: input.request.city,
        propertyType: input.request.propertyType,
        requestStatus: input.request.status,
        surface: "property_request_alert_email",
        action: "sent",
        category: input.subscription.role,
      },
    });
  },
};

function toTitleCase(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatBudgetLabel(request: PropertyRequest) {
  if (typeof request.budgetMin !== "number" && typeof request.budgetMax !== "number") {
    return null;
  }

  const formatter = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: request.currencyCode || "NGN",
    maximumFractionDigits: 0,
  });

  const formatValue = (value: number | null) => {
    if (typeof value !== "number") return null;
    return formatter.format(value / 100);
  };

  const min = formatValue(request.budgetMin);
  const max = formatValue(request.budgetMax);
  if (min && max) return `${min} - ${max}`;
  return min || max;
}

function formatBedroomsLabel(value: number | null) {
  if (typeof value !== "number") return null;
  if (value === 0) return "Studio / 0";
  return `${value} bedroom${value === 1 ? "" : "s"}`;
}

export async function notifyHostsOfPublishedPropertyRequest(
  request: PropertyRequest,
  deps: PropertyRequestPublishedAlertDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return { ok: false as const, attempted: 0, sent: 0, skipped: 0, reason: "service_role_missing" };
  }

  const client = deps.createServiceRoleClient();
  const subscriptions = await deps.loadActiveSubscriptions(client as unknown as QueryClientLike, request);
  if (subscriptions.length === 0) {
    return { ok: true as const, attempted: 0, sent: 0, skipped: 0 };
  }

  const subscriptionIds = subscriptions.map((subscription) => subscription.id);
  const existingDeliveries = await deps.loadExistingDeliveries(
    client as unknown as QueryClientLike,
    request.id,
    subscriptionIds
  );
  const undeliveredSubscriptions = subscriptions.filter(
    (subscription) => !existingDeliveries.has(subscription.id)
  );
  if (undeliveredSubscriptions.length === 0) {
    return { ok: true as const, attempted: 0, sent: 0, skipped: subscriptions.length };
  }

  const uniqueUserIds = Array.from(new Set(undeliveredSubscriptions.map((subscription) => subscription.userId)));
  const profiles = await deps.loadProfileAlertPreferences(
    client as unknown as QueryClientLike,
    uniqueUserIds
  );
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const recipients = undeliveredSubscriptions.filter((subscription) => {
    const profile = profileById.get(subscription.userId);
    return profile?.property_request_alerts_enabled === true && profile.role === subscription.role;
  });

  if (recipients.length === 0) {
    return { ok: true as const, attempted: 0, sent: 0, skipped: subscriptions.length };
  }

  const siteUrl = await deps.getSiteUrl({ allowFallback: true });
  const requestUrl = `${siteUrl.replace(/\/$/, "")}/requests/${encodeURIComponent(request.id)}?source=request-alert`;
  const manageAlertsUrl = `${siteUrl.replace(/\/$/, "")}/dashboard/saved-searches#request-alerts`;
  const email = buildPropertyRequestPublishedAlertEmail({
    requestId: request.id,
    titleLabel: getPropertyRequestDisplayTitle(request),
    intentLabel: getPropertyRequestIntentLabel(request.intent),
    marketLabel: request.marketCode,
    locationLabel: getPropertyRequestLocationSummary(request),
    budgetLabel: formatBudgetLabel(request),
    propertyTypeLabel: toTitleCase(request.propertyType),
    bedroomsLabel: formatBedroomsLabel(request.bedrooms),
    moveTimelineLabel: getPropertyRequestMoveTimelineLabel(request.moveTimeline),
    requestUrl,
    manageAlertsUrl,
  });

  let attempted = 0;
  let sent = 0;
  let skipped = subscriptions.length - recipients.length;

  for (const subscription of recipients) {
    let attemptedSend = false;
    let deliveryRecorded = false;

    try {
      const recipientEmail = await deps.getUserEmail(
        client as unknown as EmailLookupClient,
        subscription.userId
      );
      if (!recipientEmail) {
        skipped += 1;
        console.warn("[property-request-alerts] recipient_email_missing", {
          requestId: request.id,
          subscriptionId: subscription.id,
          userId: subscription.userId,
        });
        continue;
      }

      attempted += 1;
      attemptedSend = true;

      const result = await deps.sendEmail({
        to: recipientEmail,
        subject: email.subject,
        html: email.html,
      });

      await deps.recordDelivery(client as unknown as QueryClientLike, {
        subscriptionId: subscription.id,
        requestId: request.id,
        userId: subscription.userId,
        deliveryStatus: result.ok ? "sent" : "failed",
      });
      deliveryRecorded = true;

      if (result.ok) {
        sent += 1;
        try {
          await deps.logSubscriberAlertSent({
            userId: subscription.userId,
            role: subscription.role,
            request,
            subscription,
          });
        } catch (error) {
          console.warn("[property-request-alerts] analytics_log_failed", {
            requestId: request.id,
            subscriptionId: subscription.id,
            userId: subscription.userId,
            message: error instanceof Error ? error.message : "unknown_error",
          });
        }
      } else {
        console.warn("[property-request-alerts] send_failed", {
          requestId: request.id,
          subscriptionId: subscription.id,
          userId: subscription.userId,
          message: result.error || "send_failed",
        });
      }
    } catch (error) {
      console.error("[property-request-alerts] notify_recipient_failed", {
        requestId: request.id,
        subscriptionId: subscription.id,
        userId: subscription.userId,
        message: error instanceof Error ? error.message : "unknown_error",
      });
      if (attemptedSend && !deliveryRecorded) {
        try {
          await deps.recordDelivery(client as unknown as QueryClientLike, {
            subscriptionId: subscription.id,
            requestId: request.id,
            userId: subscription.userId,
            deliveryStatus: "failed",
          });
        } catch (recordError) {
          console.error("[property-request-alerts] notify_recipient_failed_delivery_unlogged", {
            requestId: request.id,
            subscriptionId: subscription.id,
            userId: subscription.userId,
            message: recordError instanceof Error ? recordError.message : "unknown_error",
          });
        }
      }
    }
  }

  return { ok: true as const, attempted, sent, skipped };
}
