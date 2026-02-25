import type { UserRole } from "@/lib/types";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type WorkspaceActivityRole = Extract<UserRole, "agent" | "landlord" | "admin">;

export type WorkspaceActivityType =
  | "lead_received"
  | "booking_request"
  | "listing_approved"
  | "payout_requested"
  | "payout_paid"
  | "support_escalated"
  | "message_received";

export type WorkspaceActivitySeverity = "neutral" | "action_required" | "success";

export type WorkspaceActivityMetadata = Record<
  string,
  string | number | boolean | null
>;

export type WorkspaceActivityItem = {
  id: string;
  type: WorkspaceActivityType;
  label: string;
  title: string;
  subtitle?: string;
  createdAt: string;
  href: string;
  ctaLabel: string;
  severity?: WorkspaceActivitySeverity;
  badge?: string;
  metadata?: WorkspaceActivityMetadata;
};

export type WorkspaceActivityFeedInput = {
  client: UntypedAdminClient;
  userId: string;
  role: WorkspaceActivityRole;
  limit?: number;
  sourceLimit?: number;
  now?: Date;
};

export type WorkspaceActivityFeedDeps = {
  loadLeadEvents: (input: WorkspaceActivityFeedInput, sourceLimit: number) => Promise<WorkspaceActivityItem[]>;
  loadBookingEvents: (input: WorkspaceActivityFeedInput, sourceLimit: number) => Promise<WorkspaceActivityItem[]>;
  loadListingApprovalEvents: (
    input: WorkspaceActivityFeedInput,
    sourceLimit: number
  ) => Promise<WorkspaceActivityItem[]>;
  loadPayoutEvents: (input: WorkspaceActivityFeedInput, sourceLimit: number) => Promise<WorkspaceActivityItem[]>;
  loadSupportEscalationEvents: (
    input: WorkspaceActivityFeedInput,
    sourceLimit: number
  ) => Promise<WorkspaceActivityItem[]>;
  loadNotificationEvents: (
    input: WorkspaceActivityFeedInput,
    sourceLimit: number
  ) => Promise<WorkspaceActivityItem[]>;
};

const DEFAULT_FEED_LIMIT = 12;
const DEFAULT_SOURCE_LIMIT = 6;

function toIsoString(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

function readPropertyMeta(row: Record<string, unknown>): { title: string; city: string } {
  const relation = row.properties;
  const property = Array.isArray(relation)
    ? (relation[0] as Record<string, unknown> | undefined)
    : (relation as Record<string, unknown> | undefined);

  return {
    title: readString(property?.title),
    city: readString(property?.city),
  };
}

function buildListingSubtitle(input: { title: string; city: string; fallbackLabel: string }) {
  const parts = [input.title, input.city].filter(Boolean);
  if (parts.length === 0) return input.fallbackLabel;
  return parts.join(" • ");
}

function isUrgentRespondBy(respondByIso: string | null, now: Date) {
  if (!respondByIso) return false;
  const respondByMs = Date.parse(respondByIso);
  if (!Number.isFinite(respondByMs)) return false;
  const diffMs = respondByMs - now.getTime();
  return diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000;
}

function isEscalatedSupportRow(row: Record<string, unknown>) {
  const metadata = row.metadata;
  const metadataRecord =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  const reason = readString(metadataRecord.escalationReason);
  const transcript = metadataRecord.aiTranscript;
  const hasTranscript = Array.isArray(transcript) && transcript.length > 0;
  const message = readString(row.message);

  return reason.length > 0 || hasTranscript || message.includes("Context:");
}

function sanitizeActivityItem(item: WorkspaceActivityItem): WorkspaceActivityItem | null {
  const id = readString(item.id);
  const label = readString(item.label);
  const title = readString(item.title);
  const href = readString(item.href);
  const ctaLabel = readString(item.ctaLabel);
  const createdAt = toIsoString(item.createdAt);

  if (!id || !label || !title || !href || !ctaLabel || !createdAt) return null;

  const subtitle = readString(item.subtitle);
  const badge = readString(item.badge);
  const severity = readString(item.severity) as WorkspaceActivitySeverity;
  const metadata =
    item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
      ? Object.fromEntries(
          Object.entries(item.metadata).filter((entry) => {
            const value = entry[1];
            return (
              value === null ||
              typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean"
            );
          })
        )
      : undefined;

  return {
    ...item,
    id,
    label,
    title,
    href,
    ctaLabel,
    createdAt,
    subtitle: subtitle || undefined,
    severity:
      severity === "neutral" || severity === "action_required" || severity === "success"
        ? severity
        : undefined,
    badge: badge || undefined,
    metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

function parseBookingIdFromHref(href: string): string | null {
  if (!href.includes("booking=")) return null;
  const queryIndex = href.indexOf("?");
  if (queryIndex < 0) return null;
  const search = href.slice(queryIndex + 1);
  const params = new URLSearchParams(search);
  const bookingId = readString(params.get("booking"));
  return bookingId || null;
}

export function resolveWorkspaceActivityHref(type: WorkspaceActivityType, activityId?: string) {
  if (type === "booking_request" && activityId) {
    return `/host/bookings?view=awaiting_approval&booking=${encodeURIComponent(activityId)}`;
  }

  switch (type) {
    case "lead_received":
      return "/host/leads";
    case "booking_request":
      return "/host/bookings?view=awaiting_approval";
    case "listing_approved":
      return "/host/listings?view=manage";
    case "payout_requested":
    case "payout_paid":
      return "/host/earnings";
    case "support_escalated":
      return "/support";
    case "message_received":
      return "/dashboard/messages";
    default:
      return "/home";
  }
}

export function resolveWorkspaceActivityLabel(type: WorkspaceActivityType) {
  switch (type) {
    case "lead_received":
      return "Lead received";
    case "booking_request":
      return "Booking request";
    case "listing_approved":
      return "Listing approved";
    case "payout_requested":
      return "Payout requested";
    case "payout_paid":
      return "Payout paid";
    case "support_escalated":
      return "Support escalation";
    case "message_received":
      return "Message";
    default:
      return "Activity";
  }
}

export function mergeWorkspaceActivityItems(items: WorkspaceActivityItem[], limit = DEFAULT_FEED_LIMIT) {
  const normalizedLimit = Math.min(50, Math.max(1, Number(limit || DEFAULT_FEED_LIMIT)));
  const deduped = new Map<string, WorkspaceActivityItem>();

  for (const item of items) {
    const sanitized = sanitizeActivityItem(item);
    if (!sanitized) continue;
    if (!deduped.has(sanitized.id)) {
      deduped.set(sanitized.id, sanitized);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, normalizedLimit);
}

async function loadLeadEvents(input: WorkspaceActivityFeedInput, sourceLimit: number) {
  const result = await input.client
    .from("listing_leads")
    .select("id,property_id,status,created_at,properties(title,city)")
    .eq("owner_id", input.userId)
    .order("created_at", { ascending: false })
    .range(0, Math.max(0, sourceLimit - 1));

  if (result.error) return [];

  return ((result.data as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => {
      const id = readString(row.id);
      const createdAt = toIsoString(row.created_at);
      if (!id || !createdAt) return null;

      const listing = readPropertyMeta(row);
      const subtitle = buildListingSubtitle({
        title: listing.title,
        city: listing.city,
        fallbackLabel: "A tenant submitted a new lead.",
      });

      return {
        id: `lead:${id}`,
        type: "lead_received",
        label: resolveWorkspaceActivityLabel("lead_received"),
        title: "New lead received",
        subtitle,
        createdAt,
        href: resolveWorkspaceActivityHref("lead_received"),
        ctaLabel: "Open lead",
        severity: "action_required",
        badge: readString(row.status).toLowerCase() === "new" ? "New" : undefined,
        metadata: {
          source: "listing_leads",
          leadId: id,
        },
      } satisfies WorkspaceActivityItem;
    })
    .filter(isPresent);
}

async function loadBookingEvents(input: WorkspaceActivityFeedInput, sourceLimit: number) {
  const result = await input.client
    .from("shortlet_bookings")
    .select("id,property_id,status,respond_by,created_at,properties(title,city)")
    .eq("host_user_id", input.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .range(0, Math.max(0, sourceLimit - 1));

  if (result.error) return [];

  return ((result.data as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => {
      const id = readString(row.id);
      const createdAt = toIsoString(row.created_at);
      if (!id || !createdAt) return null;

      const listing = readPropertyMeta(row);
      const subtitle = buildListingSubtitle({
        title: listing.title,
        city: listing.city,
        fallbackLabel: "Awaiting your response.",
      });

      const respondByIso = toIsoString(row.respond_by);
      const urgent = isUrgentRespondBy(respondByIso, input.now ?? new Date());

      return {
        id: `booking:${id}`,
        type: "booking_request",
        label: resolveWorkspaceActivityLabel("booking_request"),
        title: "Booking request awaiting approval",
        subtitle,
        createdAt,
        href: resolveWorkspaceActivityHref("booking_request", id),
        ctaLabel: "Open booking",
        severity: urgent ? "action_required" : "neutral",
        badge: urgent ? "Urgent" : "Awaiting",
        metadata: {
          source: "shortlet_bookings",
          bookingId: id,
          urgent,
        },
      } satisfies WorkspaceActivityItem;
    })
    .filter(isPresent);
}

async function loadListingApprovalEvents(input: WorkspaceActivityFeedInput, sourceLimit: number) {
  const safeLimit = Math.max(0, sourceLimit - 1);
  const [ownerApprovedResult, eventResult] = await Promise.all([
    input.client
      .from("properties")
      .select("id,title,city,approved_at,updated_at,status")
      .eq("owner_id", input.userId)
      .eq("is_approved", true)
      .order("approved_at", { ascending: false })
      .range(0, safeLimit),
    input.client
      .from("property_events")
      .select("id,property_id,event_type,occurred_at,properties(title,city)")
      .eq("actor_user_id", input.userId)
      .in("event_type", ["listing_auto_approved", "listing_payment_succeeded"])
      .order("occurred_at", { ascending: false })
      .range(0, safeLimit),
  ]);

  const ownerApprovedRows = ownerApprovedResult.error
    ? []
    : ((ownerApprovedResult.data as Array<Record<string, unknown>> | null) ?? []);
  const eventRows = eventResult.error
    ? []
    : ((eventResult.data as Array<Record<string, unknown>> | null) ?? []);

  const ownerApprovedItems = ownerApprovedRows
    .map((row) => {
      const propertyId = readString(row.id);
      const createdAt = toIsoString(row.approved_at) || toIsoString(row.updated_at);
      if (!propertyId || !createdAt) return null;

      const listing = {
        title: readString(row.title),
        city: readString(row.city),
      };
      const subtitle = buildListingSubtitle({
        title: listing.title,
        city: listing.city,
        fallbackLabel: "Your listing is now market-ready.",
      });

      return {
        id: `listing:${propertyId}`,
        type: "listing_approved",
        label: resolveWorkspaceActivityLabel("listing_approved"),
        title: "Listing approved",
        subtitle,
        createdAt,
        href: resolveWorkspaceActivityHref("listing_approved"),
        ctaLabel: "Open listing",
        severity: "success",
        badge: "Live",
        metadata: {
          source: "properties",
          propertyId,
          status: readString(row.status).toLowerCase() || null,
        },
      } satisfies WorkspaceActivityItem;
    })
    .filter(isPresent);

  const eventItems = eventRows
    .map((row) => {
      const propertyId = readString(row.property_id);
      const createdAt = toIsoString(row.occurred_at);
      if (!propertyId || !createdAt) return null;

      const eventType = readString(row.event_type);
      const listing = readPropertyMeta(row);
      const subtitle = buildListingSubtitle({
        title: listing.title,
        city: listing.city,
        fallbackLabel: "Your listing is now market-ready.",
      });

      return {
        id: `listing:${propertyId}`,
        type: "listing_approved",
        label: resolveWorkspaceActivityLabel("listing_approved"),
        title: eventType === "listing_auto_approved" ? "Listing auto-approved" : "Listing approved",
        subtitle,
        createdAt,
        href: resolveWorkspaceActivityHref("listing_approved"),
        ctaLabel: "Open listing",
        severity: "success",
        badge: "Live",
        metadata: {
          source: "property_events",
          propertyId,
          eventType: eventType || null,
        },
      } satisfies WorkspaceActivityItem;
    })
    .filter(isPresent);

  return mergeWorkspaceActivityItems([...eventItems, ...ownerApprovedItems], sourceLimit);
}

async function loadPayoutEvents(input: WorkspaceActivityFeedInput, sourceLimit: number) {
  const [requestResult, paidResult] = await Promise.all([
    input.client
      .from("shortlet_payout_audit")
      .select("id,payout_id,booking_id,actor_user_id,action,created_at")
      .eq("action", "request_payout")
      .eq("actor_user_id", input.userId)
      .order("created_at", { ascending: false })
      .range(0, Math.max(0, sourceLimit - 1)),
    input.client
      .from("shortlet_payouts")
      .select("id,booking_id,host_user_id,status,paid_at,updated_at")
      .eq("host_user_id", input.userId)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .range(0, Math.max(0, sourceLimit - 1)),
  ]);

  const requested = requestResult.error
    ? []
    : (((requestResult.data as Array<Record<string, unknown>> | null) ?? [])
        .map((row) => {
          const id = readString(row.id) || readString(row.payout_id);
          const createdAt = toIsoString(row.created_at);
          if (!id || !createdAt) return null;
          return {
            id: `payout-request:${id}`,
            type: "payout_requested",
            label: resolveWorkspaceActivityLabel("payout_requested"),
            title: "Payout requested",
            subtitle: "Awaiting admin payout processing.",
            createdAt,
            href: resolveWorkspaceActivityHref("payout_requested"),
            ctaLabel: "Open earnings",
            severity: "neutral",
            badge: "Requested",
            metadata: {
              source: "shortlet_payout_audit",
            },
          } satisfies WorkspaceActivityItem;
        })
        .filter(isPresent));

  const paid = paidResult.error
    ? []
    : (((paidResult.data as Array<Record<string, unknown>> | null) ?? [])
        .map((row) => {
          const id = readString(row.id);
          const createdAt = toIsoString(row.paid_at) || toIsoString(row.updated_at);
          if (!id || !createdAt) return null;
          return {
            id: `payout-paid:${id}`,
            type: "payout_paid",
            label: resolveWorkspaceActivityLabel("payout_paid"),
            title: "Payout marked paid",
            subtitle: "Payment has been settled to your configured payout method.",
            createdAt,
            href: resolveWorkspaceActivityHref("payout_paid"),
            ctaLabel: "Open earnings",
            severity: "success",
            badge: "Paid",
            metadata: {
              source: "shortlet_payouts",
              payoutId: id,
            },
          } satisfies WorkspaceActivityItem;
        })
        .filter(isPresent));

  return [...requested, ...paid];
}

async function loadSupportEscalationEvents(input: WorkspaceActivityFeedInput, sourceLimit: number) {
  const result = await input.client
    .from("support_requests")
    .select("id,category,status,message,created_at,metadata,user_id")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .range(0, Math.max(0, sourceLimit * 2 - 1));

  if (result.error) return [];

  return ((result.data as Array<Record<string, unknown>> | null) ?? [])
    .filter((row) => isEscalatedSupportRow(row))
    .slice(0, sourceLimit)
    .map((row) => {
      const id = readString(row.id);
      const createdAt = toIsoString(row.created_at);
      if (!id || !createdAt) return null;

      const category = readString(row.category) || "support";
      const status = readString(row.status).toLowerCase();

      return {
        id: `support:${id}`,
        type: "support_escalated",
        label: resolveWorkspaceActivityLabel("support_escalated"),
        title: "Support escalation submitted",
        subtitle: `Category: ${category}`,
        createdAt,
        href: resolveWorkspaceActivityHref("support_escalated"),
        ctaLabel: "Open support",
        severity: status === "resolved" ? "success" : "action_required",
        badge: status === "resolved" ? "Resolved" : "New",
        metadata: {
          source: "support_requests",
          category,
          status: status || null,
        },
      } satisfies WorkspaceActivityItem;
    })
    .filter(isPresent);
}

async function loadNotificationEvents(input: WorkspaceActivityFeedInput, sourceLimit: number) {
  const result = await input.client
    .from("notifications")
    .select("id,type,title,body,href,created_at,is_read")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .range(0, Math.max(0, sourceLimit * 2 - 1));

  if (result.error) return [];

  const mapped = ((result.data as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => {
      const notificationId = readString(row.id);
      const notificationType = readString(row.type).toLowerCase();
      const createdAt = toIsoString(row.created_at);
      const title = readString(row.title);
      const subtitle = readString(row.body) || undefined;
      const href = readString(row.href) || "/home";
      if (!notificationId || !createdAt || !notificationType || !title) return null;

      if (notificationType === "shortlet_booking_request_sent") {
        const bookingId = parseBookingIdFromHref(href);
        const isRead = readBoolean(row.is_read);
        return {
          id: bookingId ? `booking:${bookingId}` : `notif-booking:${notificationId}`,
          type: "booking_request",
          label: resolveWorkspaceActivityLabel("booking_request"),
          title,
          subtitle,
          createdAt,
          href,
          ctaLabel: "Open booking",
          severity: "action_required",
          badge: isRead ? undefined : "New",
          metadata: {
            source: "notifications",
            notificationId,
            notificationType,
          },
        } satisfies WorkspaceActivityItem;
      }

      if (notificationType === "shortlet_booking_host_update") {
        return {
          id: `notif-message:${notificationId}`,
          type: "message_received",
          label: resolveWorkspaceActivityLabel("message_received"),
          title,
          subtitle,
          createdAt,
          href,
          ctaLabel: "Open update",
          severity: "neutral",
          badge: "Update",
          metadata: {
            source: "notifications",
            notificationId,
            notificationType,
          },
        } satisfies WorkspaceActivityItem;
      }

      return null;
    })
    .filter(isPresent);

  return mapped.slice(0, sourceLimit);
}

const defaultDeps: WorkspaceActivityFeedDeps = {
  loadLeadEvents,
  loadBookingEvents,
  loadListingApprovalEvents,
  loadPayoutEvents,
  loadSupportEscalationEvents,
  loadNotificationEvents,
};

async function runSafeLoader(
  loader: (input: WorkspaceActivityFeedInput, sourceLimit: number) => Promise<WorkspaceActivityItem[]>,
  input: WorkspaceActivityFeedInput,
  sourceLimit: number
) {
  try {
    return await loader(input, sourceLimit);
  } catch {
    return [] as WorkspaceActivityItem[];
  }
}

export async function getWorkspaceActivityFeed(
  input: WorkspaceActivityFeedInput,
  deps: WorkspaceActivityFeedDeps = defaultDeps
): Promise<WorkspaceActivityItem[]> {
  const normalizedLimit = Math.min(50, Math.max(1, Number(input.limit || DEFAULT_FEED_LIMIT)));
  const sourceLimit = Math.min(20, Math.max(1, Number(input.sourceLimit || DEFAULT_SOURCE_LIMIT)));

  const [leadEvents, bookingEvents, listingApprovalEvents, payoutEvents, supportEscalationEvents, notificationEvents] =
    await Promise.all([
      runSafeLoader(deps.loadLeadEvents, input, sourceLimit),
      runSafeLoader(deps.loadBookingEvents, input, sourceLimit),
      runSafeLoader(deps.loadListingApprovalEvents, input, sourceLimit),
      runSafeLoader(deps.loadPayoutEvents, input, sourceLimit),
      runSafeLoader(deps.loadSupportEscalationEvents, input, sourceLimit),
      runSafeLoader(deps.loadNotificationEvents, input, sourceLimit),
    ]);

  return mergeWorkspaceActivityItems(
    [
      ...leadEvents,
      ...bookingEvents,
      ...listingApprovalEvents,
      ...payoutEvents,
      ...supportEscalationEvents,
      ...notificationEvents,
    ],
    normalizedLimit
  );
}
