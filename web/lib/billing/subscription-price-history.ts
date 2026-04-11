import type { BillingCadence, BillingRole } from "@/lib/billing/stripe-plans";
import type { SubscriptionPriceBookAuditLogRow } from "@/lib/billing/subscription-price-book";

export type AdminSubscriptionPriceAuditFilters = {
  market: string;
  role: string;
  cadence: string;
  eventType: string;
  actorId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
};

const EMPTY_FILTERS: AdminSubscriptionPriceAuditFilters = {
  market: "ALL",
  role: "all",
  cadence: "all",
  eventType: "all",
  actorId: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
};

function pickParam(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

export function parseAdminSubscriptionPriceAuditFilters(
  params: Record<string, string | string[] | undefined>
): AdminSubscriptionPriceAuditFilters {
  const rawPage = Number.parseInt(pickParam(params.page, String(EMPTY_FILTERS.page)), 10);
  return {
    market: pickParam(params.market, EMPTY_FILTERS.market).toUpperCase(),
    role: pickParam(params.role, EMPTY_FILTERS.role).toLowerCase(),
    cadence: pickParam(params.cadence, EMPTY_FILTERS.cadence).toLowerCase(),
    eventType: pickParam(params.eventType, EMPTY_FILTERS.eventType).toLowerCase(),
    actorId: pickParam(params.actorId, EMPTY_FILTERS.actorId).trim(),
    dateFrom: pickParam(params.dateFrom, EMPTY_FILTERS.dateFrom).trim(),
    dateTo: pickParam(params.dateTo, EMPTY_FILTERS.dateTo).trim(),
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function buildSubscriptionPriceHistoryHref(input: {
  marketCountry?: string;
  role?: BillingRole;
  cadence?: BillingCadence;
  eventType?: SubscriptionPriceBookAuditLogRow["event_type"];
  actorId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
}) {
  const search = new URLSearchParams();
  if (input.marketCountry) search.set("market", input.marketCountry);
  if (input.role) search.set("role", input.role);
  if (input.cadence) search.set("cadence", input.cadence);
  if (input.eventType) search.set("eventType", input.eventType);
  if (input.actorId) search.set("actorId", input.actorId);
  if (input.dateFrom) search.set("dateFrom", input.dateFrom);
  if (input.dateTo) search.set("dateTo", input.dateTo);
  if (input.page && input.page > 1) search.set("page", String(input.page));
  const query = search.toString();
  return query ? `/admin/settings/billing/prices/history?${query}` : "/admin/settings/billing/prices/history";
}

export function formatSubscriptionPriceAuditEventLabel(
  eventType: SubscriptionPriceBookAuditLogRow["event_type"]
) {
  if (eventType === "draft_created") return "Draft created";
  if (eventType === "draft_updated") return "Draft updated";
  if (eventType === "stripe_price_created") return "Stripe price created";
  if (eventType === "stripe_price_invalidated") return "Stripe price invalidated";
  return "Published";
}

export const SUBSCRIPTION_PRICE_AUDIT_EVENT_OPTIONS: Array<{
  value: SubscriptionPriceBookAuditLogRow["event_type"];
  label: string;
}> = [
  { value: "draft_created", label: "Draft created" },
  { value: "draft_updated", label: "Draft updated" },
  { value: "stripe_price_created", label: "Stripe price created" },
  { value: "stripe_price_invalidated", label: "Stripe price invalidated" },
  { value: "published", label: "Published" },
];
