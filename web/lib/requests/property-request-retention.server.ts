import { getSiteUrl } from "@/lib/env";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { buildPropertyRequestExpiryReminderEmail } from "@/lib/email/templates/property-request-expiry-reminder";
import {
  PROPERTY_REQUEST_SELECT_COLUMNS,
  canExtendPropertyRequestExpiry,
  getPropertyRequestDisplayTitle,
  getPropertyRequestIntentLabel,
  getPropertyRequestLocationSummary,
  isPropertyRequestDueForExpiryReminder,
  mapPropertyRequestRecord,
  resolveExtendedPropertyRequestExpiry,
  type PropertyRequest,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type EmailLookupClient = {
  auth: {
    admin: {
      getUserById: (
        userId: string
      ) => Promise<{ data?: { user?: { email?: string | null } | null } | null }>;
    };
  };
};

export type PropertyRequestExpiryReminderDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getSiteUrl: typeof getSiteUrl;
  now: () => Date;
  loadCandidateRequests: (
    client: UntypedAdminClient,
    input: { lowerBound: string; upperBound: string }
  ) => Promise<PropertyRequestRecord[]>;
  getUserEmail: (client: EmailLookupClient, userId: string) => Promise<string | null>;
  markReminderSent: (
    client: UntypedAdminClient,
    input: { requestId: string; expiresAt: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  sendEmail: (input: { to: string; subject: string; html: string }) => Promise<{ ok: boolean; error?: string }>;
};

const defaultDeps: PropertyRequestExpiryReminderDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  getSiteUrl,
  now: () => new Date(),
  async loadCandidateRequests(client, input) {
    const { data } = await client
      .from<PropertyRequestRecord>("property_requests")
      .select(PROPERTY_REQUEST_SELECT_COLUMNS)
      .eq("status", "open")
      .not("published_at", "is", null)
      .not("expires_at", "is", null)
      .gte("expires_at", input.lowerBound)
      .lte("expires_at", input.upperBound)
      .order("expires_at", { ascending: true });

    return Array.isArray(data) ? data : [];
  },
  async getUserEmail(client, userId) {
    const response = await client.auth.admin.getUserById(userId);
    const email = response.data?.user?.email ?? null;
    const normalized = String(email || "").trim();
    return normalized || null;
  },
  async markReminderSent(client, input) {
    const { error } = await client
      .from("property_requests")
      .update({ last_expiry_reminder_for_expires_at: input.expiresAt })
      .eq("id", input.requestId)
      .eq("status", "open");

    if (error) {
      return { ok: false, error: error.message || "Unable to mark reminder sent" };
    }
    return { ok: true };
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

function formatExpiryLabel(expiresAt: string | null) {
  if (!expiresAt) return "soon";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function resolvePropertyRequestReminderWindow(now: Date) {
  const lowerBound = new Date(now.getTime() + (72 - 26) * 60 * 60 * 1000).toISOString();
  const upperBound = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
  return { lowerBound, upperBound };
}

export async function dispatchPropertyRequestExpiryReminders(
  deps: PropertyRequestExpiryReminderDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return { ok: false as const, scanned: 0, due: 0, sent: 0, skipped: 0, errors: ["service_role_missing"] };
  }

  const now = deps.now();
  const window = resolvePropertyRequestReminderWindow(now);
  const client = deps.createServiceRoleClient();
  const requestRows = await deps.loadCandidateRequests(client as unknown as UntypedAdminClient, window);
  const requests = requestRows.map(mapPropertyRequestRecord);
  const due = requests.filter((request) =>
    isPropertyRequestDueForExpiryReminder({
      status: request.status,
      publishedAt: request.publishedAt,
      expiresAt: request.expiresAt,
      lastReminderForExpiresAt: request.lastExpiryReminderForExpiresAt,
      now,
    })
  );

  if (due.length === 0) {
    return { ok: true as const, scanned: requestRows.length, due: 0, sent: 0, skipped: 0, errors: [] as string[] };
  }

  const siteUrl = await deps.getSiteUrl({ allowFallback: true });
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const request of due) {
    const expiresAt = request.expiresAt;
    if (!expiresAt) {
      skipped += 1;
      continue;
    }

    const recipientEmail = await deps.getUserEmail(client as unknown as EmailLookupClient, request.ownerUserId);
    if (!recipientEmail) {
      skipped += 1;
      continue;
    }

    const extendUrl = `${siteUrl.replace(/\/$/, "")}/requests/${encodeURIComponent(request.id)}/extend`;
    const manageUrl = `${siteUrl.replace(/\/$/, "")}/requests/${encodeURIComponent(request.id)}`;
    const email = buildPropertyRequestExpiryReminderEmail({
      titleLabel: getPropertyRequestDisplayTitle(request),
      intentLabel: getPropertyRequestIntentLabel(request.intent),
      marketLabel: request.marketCode,
      locationLabel: getPropertyRequestLocationSummary(request),
      budgetLabel: formatBudgetLabel(request),
      propertyTypeLabel: toTitleCase(request.propertyType),
      bedroomsLabel: formatBedroomsLabel(request.bedrooms),
      expiryLabel: formatExpiryLabel(request.expiresAt),
      extendUrl,
      manageUrl,
    });

    const sendResult = await deps.sendEmail({
      to: recipientEmail,
      subject: email.subject,
      html: email.html,
    });

    if (!sendResult.ok) {
      errors.push(`send_failed:${request.id}:${sendResult.error || "unknown"}`);
      continue;
    }

    const markResult = await deps.markReminderSent(client as unknown as UntypedAdminClient, {
      requestId: request.id,
      expiresAt,
    });
    if (!markResult.ok) {
      errors.push(`mark_failed:${request.id}:${markResult.error || "unknown"}`);
      continue;
    }

    sent += 1;
  }

  return {
    ok: true as const,
    scanned: requestRows.length,
    due: due.length,
    sent,
    skipped,
    errors,
  };
}

export function resolvePropertyRequestExtension(input: {
  request: Pick<PropertyRequest, "status" | "publishedAt" | "expiresAt" | "extensionCount">;
  now: Date;
}) {
  const canExtend = canExtendPropertyRequestExpiry({
    status: input.request.status,
    publishedAt: input.request.publishedAt,
    expiresAt: input.request.expiresAt,
    extensionCount: input.request.extensionCount,
    now: input.now,
  });

  if (!canExtend) {
    return { ok: false as const, nextExpiresAt: null, nextExtensionCount: input.request.extensionCount };
  }

  return {
    ok: true as const,
    nextExpiresAt: resolveExtendedPropertyRequestExpiry({
      expiresAt: input.request.expiresAt,
      now: input.now,
    }),
    nextExtensionCount: input.request.extensionCount + 1,
  };
}
