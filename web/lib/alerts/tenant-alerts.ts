import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
import { getTenantPlanForTier } from "@/lib/plans";
import {
  formatPushFailed,
  formatPushPruned,
  formatPushUnavailable,
  type PushDeliveryOutcome,
} from "@/lib/push/outcomes";
import {
  getPushConfig,
  sendPushNotification,
  type PushSendResult,
  type PushSubscriptionRow,
} from "@/lib/push/server";
import { parseFiltersFromSavedSearch, propertyMatchesFilters } from "@/lib/search-filters";
import type { Property, SavedSearch } from "@/lib/types";

type AlertDispatchResult = {
  ok: boolean;
  matched: number;
  sent: number;
  skipped: number;
  status?: number;
  error?: string;
};

type EmailDispatchGuard = {
  ok: boolean;
  status: number;
  error?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function isPlanExpired(validUntil: string | null) {
  if (!validUntil) return false;
  const parsed = Date.parse(validUntil);
  return Number.isFinite(parsed) && parsed < Date.now();
}

export function getEmailDispatchGuard(): EmailDispatchGuard {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return { ok: false, status: 503, error: "Email not configured" };
  }
  return { ok: true, status: 200 };
}

async function sendAlertEmail(input: {
  to: string;
  property: Property;
  searchName: string;
}) {
  const guard = getEmailDispatchGuard();
  if (!guard.ok) {
    return { status: "skipped" as const, error: guard.error || "Email not configured" };
  }
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const from = process.env.RESEND_FROM ?? "";

  const siteUrl = await getSiteUrl();
  const listingUrl = `${siteUrl}/properties/${input.property.id}`;
  const subject = `New listing match: ${input.property.title}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="margin: 0 0 8px;">${input.property.title}</h2>
      <p style="margin: 0 0 12px;">We found a new listing matching your saved search "${input.searchName}".</p>
      <p style="margin: 0 0 12px;"><strong>${input.property.city}</strong> · ${input.property.currency} ${input.property.price.toLocaleString()}</p>
      <a href="${listingUrl}" style="display: inline-block; padding: 10px 16px; background: #0ea5e9; color: #fff; text-decoration: none; border-radius: 8px;">View listing</a>
    </div>
  `;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { status: "failed" as const, error: body || res.statusText };
  }

  return { status: "sent" as const, error: null };
}

export async function deliverPushNotifications(input: {
  adminDb: SupabaseClient;
  userId: string;
  subscriptions: PushSubscriptionRow[];
  payload: Record<string, unknown>;
  sendPush?: (input: {
    subscription: PushSubscriptionRow;
    payload: Record<string, unknown>;
  }) => Promise<PushSendResult>;
}): Promise<PushDeliveryOutcome> {
  if (!input.subscriptions.length) {
    return {
      attempted: false,
      status: "skipped",
      error: formatPushUnavailable("missing_subscription"),
    };
  }

  const sendPush = input.sendPush ?? sendPushNotification;
  let successCount = 0;
  let lastError: string | null = null;
  let lastStatus: number | null = null;
  const staleEndpoints: string[] = [];

  for (const subscription of input.subscriptions) {
    const result = await sendPush({
      subscription,
      payload: input.payload,
    });
    if (result.ok) {
      successCount += 1;
      continue;
    }
    lastError = result.error;
    if (typeof result.statusCode === "number") {
      lastStatus = result.statusCode;
      if (result.statusCode === 404 || result.statusCode === 410) {
        staleEndpoints.push(subscription.endpoint);
      }
    }
  }

  const prunedMarker = staleEndpoints.length ? formatPushPruned("gone") : null;
  if (staleEndpoints.length) {
    await input.adminDb
      .from("push_subscriptions")
      .delete()
      .eq("profile_id", input.userId)
      .in("endpoint", staleEndpoints);
  }

  if (successCount > 0) {
    return {
      attempted: true,
      status: "sent",
      error: prunedMarker ?? undefined,
    };
  }

  let failureReason = "delivery_failed";
  if (lastStatus === 404 || lastStatus === 410) {
    failureReason = "gone";
  } else if (lastStatus === 401 || lastStatus === 403) {
    failureReason = "unauthorized";
  } else if (lastStatus === 429) {
    failureReason = "rate_limited";
  } else if (lastStatus && lastStatus >= 500) {
    failureReason = "provider_error";
  } else if (lastError) {
    failureReason = lastError;
  }

  return {
    attempted: true,
    status: "failed",
    error: prunedMarker
      ? `${formatPushFailed(failureReason)} | ${prunedMarker}`
      : formatPushFailed(failureReason),
  };
}

export async function dispatchSavedSearchAlerts(
  propertyId: string
): Promise<AlertDispatchResult> {
  if (!hasServiceRoleEnv()) {
    return {
      ok: false,
      matched: 0,
      sent: 0,
      skipped: 0,
      status: 503,
      error: "Service role missing",
    };
  }

  const emailGuard = getEmailDispatchGuard();
  const pushConfig = getPushConfig();
  const pushReady = pushConfig.configured;

  if (!emailGuard.ok && !pushReady) {
    return {
      ok: false,
      matched: 0,
      sent: 0,
      skipped: 0,
      status: 503,
      error: "Email and push delivery are not configured",
    };
  }

  const adminClient = createServiceRoleClient();
  const adminDb = adminClient as SupabaseClient;

  const { data: propertyData, error: propertyError } = await adminDb
    .from("properties")
    .select(
      "id, title, city, price, currency, bedrooms, rental_type, furnished, amenities, is_active, is_approved"
    )
    .eq("id", propertyId);

  if (propertyError || !Array.isArray(propertyData) || !propertyData[0]) {
    return {
      ok: false,
      matched: 0,
      sent: 0,
      skipped: 0,
      error: propertyError?.message || "Property not found",
    };
  }

  const property = propertyData[0] as Property;
  if (!property.is_active || !property.is_approved) {
    return { ok: true, matched: 0, sent: 0, skipped: 0 };
  }

  const siteUrl = await getSiteUrl();

  const { data: savedSearchesRaw, error: searchesError } = await adminDb
    .from("saved_searches")
    .select("id, user_id, name, query_params");
  if (searchesError || !Array.isArray(savedSearchesRaw)) {
    return {
      ok: false,
      matched: 0,
      sent: 0,
      skipped: 0,
      error: searchesError?.message || "Unable to load saved searches",
    };
  }

  const savedSearches = savedSearchesRaw as SavedSearch[];
  if (!savedSearches.length) {
    return { ok: true, matched: 0, sent: 0, skipped: 0 };
  }

  const userIds = Array.from(new Set(savedSearches.map((search) => search.user_id)));
  const { data: planRows } = await adminClient
    .from("profile_plans")
    .select("profile_id, plan_tier, valid_until")
    .in("profile_id", userIds);
  const planMap = new Map<string, { plan_tier?: string | null; valid_until?: string | null }>();
  if (Array.isArray(planRows)) {
    planRows.forEach((row) => {
      const typed = row as { profile_id: string; plan_tier?: string | null; valid_until?: string | null };
      planMap.set(typed.profile_id, typed);
    });
  }

  const emailMap = new Map<string, string>();
  if (emailGuard.ok) {
    const { data: userList } = await adminClient.auth.admin.listUsers({ perPage: 2000 });
    userList?.users?.forEach((user) => {
      if (user.email) emailMap.set(user.id, user.email);
    });
  }

  const pushSubscriptions = new Map<string, PushSubscriptionRow[]>();
  let pushLoadError: string | null = null;
  if (pushReady && userIds.length) {
    const { data: pushRows, error: pushError } = await adminDb
      .from("push_subscriptions")
      .select("profile_id, endpoint, p256dh, auth")
      .in("profile_id", userIds)
      .eq("is_active", true);
    if (pushError) {
      pushLoadError = pushError.message;
    } else if (Array.isArray(pushRows)) {
      pushRows.forEach((row) => {
        const typed = row as { profile_id: string; endpoint: string; p256dh: string; auth: string };
        const existing = pushSubscriptions.get(typed.profile_id) ?? [];
        existing.push({
          endpoint: typed.endpoint,
          p256dh: typed.p256dh,
          auth: typed.auth,
        });
        pushSubscriptions.set(typed.profile_id, existing);
      });
    }
  }

  let matched = 0;
  let sent = 0;
  let skipped = 0;

  for (const search of savedSearches) {
    const filters = parseFiltersFromSavedSearch(search.query_params || {});
    if (!propertyMatchesFilters(property, filters)) continue;
    matched += 1;

    const planRow = planMap.get(search.user_id);
    const expired = isPlanExpired(planRow?.valid_until ?? null);
    const tenantPlan = getTenantPlanForTier(expired ? "free" : planRow?.plan_tier ?? "free");
    if (tenantPlan.tier !== "tenant_pro") {
      skipped += 1;
      continue;
    }

    const { data: alertRow, error: insertError } = await adminDb
      .from("saved_search_alerts")
      .insert({
        user_id: search.user_id,
        saved_search_id: search.id,
        property_id: property.id,
        channel: "email",
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select("id");

    if (insertError) {
      if (insertError.code === "23505") {
        skipped += 1;
        continue;
      }
      skipped += 1;
      continue;
    }

    const alertId = Array.isArray(alertRow) ? (alertRow[0] as { id?: string })?.id : null;
    if (!alertId) {
      skipped += 1;
      continue;
    }

    const recipientEmail = emailMap.get(search.user_id);
    const emailAttempted = emailGuard.ok && !!recipientEmail;
    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    let emailError: string | null = null;

    if (!emailGuard.ok) {
      emailStatus = "skipped";
      emailError = emailGuard.error ?? "email_not_configured";
    } else if (!recipientEmail) {
      emailStatus = "skipped";
      emailError = "missing_recipient_email";
    } else {
      const emailResult = await sendAlertEmail({
        to: recipientEmail,
        property,
        searchName: search.name,
      });
      emailStatus = emailResult.status;
      emailError = emailResult.error;
    }

    let pushOutcome: PushDeliveryOutcome = {
      attempted: false,
      status: "skipped",
      error: formatPushUnavailable("not_configured"),
    };

    if (pushReady) {
      if (pushLoadError) {
        pushOutcome = {
          attempted: false,
          status: "skipped",
          error: formatPushUnavailable("subscription_lookup_failed"),
        };
      } else {
        const subscriptions = pushSubscriptions.get(search.user_id) ?? [];
        pushOutcome = await deliverPushNotifications({
          adminDb,
          userId: search.user_id,
          subscriptions,
          payload: {
            title: "New listing match",
            body: `${property.title} matches "${search.name}".`,
            url: `${siteUrl}/properties/${property.id}`,
          },
        });
      }
    }

    const pushConsidered =
      pushOutcome.attempted || (pushOutcome.error ?? "").startsWith("push_unavailable:");
    const channel = pushConsidered
      ? emailAttempted
        ? "email+push"
        : "push"
      : "email";

    const alertStatus =
      emailStatus === "sent" || pushOutcome.status === "sent"
        ? "sent"
        : emailStatus === "failed" || pushOutcome.status === "failed"
          ? "failed"
          : "skipped";

    const errorParts: string[] = [];
    if (emailStatus !== "sent") {
      errorParts.push(`email_${emailStatus}:${emailError ?? "unknown"}`);
    }
    if (pushOutcome.error) {
      errorParts.push(pushOutcome.error);
    }
    const errorMessage = errorParts.length ? errorParts.join(" | ") : null;

    if (alertStatus === "sent") {
      sent += 1;
    } else {
      skipped += 1;
    }

    const updatePayload: Record<string, unknown> = {
      status: alertStatus,
      channel,
      error: errorMessage,
    };

    if (alertStatus === "sent") {
      updatePayload.sent_at = new Date().toISOString();
    }

    await adminDb.from("saved_search_alerts").update(updatePayload).eq("id", alertId);

    if (alertStatus === "sent") {
      await adminDb
        .from("saved_searches")
        .update({ last_notified_at: new Date().toISOString() })
        .eq("id", search.id);
    }
  }

  return { ok: true, matched, sent, skipped };
}
