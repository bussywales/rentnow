import { getSiteUrl } from "@/lib/env";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { buildPropertyRequestPublishedAlertEmail } from "@/lib/email/templates/property-request-published-alert";
import {
  doesListingIntentMatchPropertyRequest,
  getPropertyRequestIntentLabel,
  getPropertyRequestLocationSummary,
  getPropertyRequestMoveTimelineLabel,
  type PropertyRequest,
} from "@/lib/requests/property-requests";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type HostAlertProfileRow = {
  id: string;
  role?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  property_request_alerts_enabled?: boolean | null;
};

type ManagedPropertyRow = {
  owner_id: string | null;
  listing_intent: string | null;
};

type ActiveDelegationRow = {
  agent_id: string;
  landlord_id: string;
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

type QueryResultLike = PromiseLike<{
  data: unknown[] | null;
  error: { message?: string | null } | null;
}>;

type QueryBuilderLike = QueryResultLike & {
  eq: (column: string, value: string | boolean) => QueryBuilderLike;
  in: (column: string, values: string[]) => QueryBuilderLike;
};

type QueryClientLike = {
  from: (table: string) => {
    select: (columns: string) => QueryBuilderLike;
  };
};

export type PropertyRequestPublishedAlertDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getSiteUrl: typeof getSiteUrl;
  loadOptedInProfiles: (client: QueryClientLike) => Promise<HostAlertProfileRow[]>;
  loadMatchingSupplyOwnerIds: (
    client: QueryClientLike,
    request: PropertyRequest
  ) => Promise<string[]>;
  loadActiveDelegations: (
    client: QueryClientLike,
    ownerIds: string[]
  ) => Promise<ActiveDelegationRow[]>;
  getUserEmail: (client: EmailLookupClient, userId: string) => Promise<string | null>;
  sendEmail: (input: { to: string; subject: string; html: string }) => Promise<{ ok: boolean; error?: string }>;
};

const defaultDeps: PropertyRequestPublishedAlertDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  getSiteUrl,
  async loadOptedInProfiles(client) {
    const { data } = await client
      .from("profiles")
      .select("id, role, display_name, full_name, property_request_alerts_enabled")
      .eq("property_request_alerts_enabled", true)
      .in("role", ["landlord", "agent"]);
    return (Array.isArray(data) ? data : []) as HostAlertProfileRow[];
  },
  async loadMatchingSupplyOwnerIds(client, request) {
    const { data } = await client
      .from("properties")
      .select("owner_id, listing_intent")
      .eq("status", "live")
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("country_code", request.marketCode);

    const rows = (Array.isArray(data) ? data : []) as ManagedPropertyRow[];
    return Array.from(
      new Set(
        rows
          .filter((row) => typeof row.owner_id === "string" && row.owner_id.length > 0)
          .filter((row) => doesListingIntentMatchPropertyRequest(row.listing_intent, request.intent))
          .map((row) => row.owner_id as string)
      )
    );
  },
  async loadActiveDelegations(client, ownerIds) {
    if (ownerIds.length === 0) return [];
    const { data } = await client
      .from("agent_delegations")
      .select("agent_id, landlord_id")
      .eq("status", "active")
      .in("landlord_id", ownerIds);
    return ((Array.isArray(data) ? data : []) as ActiveDelegationRow[]).filter(
      (row) => typeof row.agent_id === "string" && typeof row.landlord_id === "string"
    );
  },
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
  const profiles = await deps.loadOptedInProfiles(client as unknown as QueryClientLike);
  if (profiles.length === 0) {
    return { ok: true as const, attempted: 0, sent: 0, skipped: 0 };
  }

  const matchingOwnerIds = await deps.loadMatchingSupplyOwnerIds(
    client as unknown as QueryClientLike,
    request
  );
  if (matchingOwnerIds.length === 0) {
    return { ok: true as const, attempted: 0, sent: 0, skipped: profiles.length };
  }

  const activeDelegations = await deps.loadActiveDelegations(
    client as unknown as QueryClientLike,
    matchingOwnerIds
  );
  const delegatedAgentIds = new Set(activeDelegations.map((row) => row.agent_id));
  const matchingOwnerIdSet = new Set(matchingOwnerIds);

  const recipients = profiles.filter((profile) => {
    if (profile.property_request_alerts_enabled !== true) return false;
    if (profile.role === "landlord") return matchingOwnerIdSet.has(profile.id);
    if (profile.role === "agent") {
      return matchingOwnerIdSet.has(profile.id) || delegatedAgentIds.has(profile.id);
    }
    return false;
  });

  if (recipients.length === 0) {
    return { ok: true as const, attempted: 0, sent: 0, skipped: profiles.length };
  }

  const siteUrl = await deps.getSiteUrl({ allowFallback: true });
  const requestUrl = `${siteUrl.replace(/\/$/, "")}/requests/${encodeURIComponent(request.id)}`;
  const email = buildPropertyRequestPublishedAlertEmail({
    requestId: request.id,
    intentLabel: getPropertyRequestIntentLabel(request.intent),
    marketLabel: request.marketCode,
    locationLabel: getPropertyRequestLocationSummary(request),
    budgetLabel: formatBudgetLabel(request),
    propertyTypeLabel: toTitleCase(request.propertyType),
    bedroomsLabel: formatBedroomsLabel(request.bedrooms),
    moveTimelineLabel: getPropertyRequestMoveTimelineLabel(request.moveTimeline),
    requestUrl,
  });

  let attempted = 0;
  let sent = 0;
  let skipped = profiles.length - recipients.length;

  for (const recipient of recipients) {
    const recipientEmail = await deps.getUserEmail(client as unknown as EmailLookupClient, recipient.id);
    if (!recipientEmail) {
      skipped += 1;
      continue;
    }
    attempted += 1;
    const result = await deps.sendEmail({
      to: recipientEmail,
      subject: email.subject,
      html: email.html,
    });
    if (result.ok) sent += 1;
  }

  return {
    ok: true as const,
    attempted,
    sent,
    skipped,
  };
}
