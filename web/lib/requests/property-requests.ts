import { z } from "zod";
import type { UserRole } from "@/lib/types";

export const PROPERTY_REQUEST_INTENTS = ["rent", "buy", "shortlet"] as const;
export type PropertyRequestIntent = (typeof PROPERTY_REQUEST_INTENTS)[number];

export const PROPERTY_REQUEST_STATUSES = [
  "draft",
  "open",
  "matched",
  "closed",
  "expired",
  "removed",
] as const;
export type PropertyRequestStatus = (typeof PROPERTY_REQUEST_STATUSES)[number];
export const PROPERTY_REQUEST_OWNER_WRITE_STATUSES = ["draft", "open", "closed"] as const;
export type PropertyRequestOwnerWriteStatus =
  (typeof PROPERTY_REQUEST_OWNER_WRITE_STATUSES)[number];

export const PROPERTY_REQUEST_RESPONDER_ROLES = ["landlord", "agent"] as const;
export type PropertyRequestResponderRole = (typeof PROPERTY_REQUEST_RESPONDER_ROLES)[number];

export const PROPERTY_REQUEST_DEFAULT_EXPIRY_DAYS = 30;
export const PROPERTY_REQUEST_PROPERTY_TYPE_OPTIONS = [
  { value: "", label: "Any property type" },
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "studio", label: "Studio" },
  { value: "duplex", label: "Duplex" },
  { value: "office", label: "Office" },
  { value: "shop", label: "Shop" },
] as const;
export const PROPERTY_REQUEST_BEDROOM_OPTIONS = [
  { value: "", label: "Any bedrooms" },
  { value: "0", label: "Studio / 0" },
  { value: "1", label: "1 bedroom" },
  { value: "2", label: "2 bedrooms" },
  { value: "3", label: "3 bedrooms" },
  { value: "4", label: "4 bedrooms" },
  { value: "5", label: "5+ bedrooms" },
] as const;
export const PROPERTY_REQUEST_MOVE_TIMELINE_OPTIONS = [
  { value: "", label: "Any timeline" },
  { value: "immediately", label: "Immediately" },
  { value: "within_30_days", label: "Within 30 days" },
  { value: "within_90_days", label: "Within 90 days" },
  { value: "planning_ahead", label: "Planning ahead" },
] as const;

export type PropertyRequestPublishMissingField =
  | "intent"
  | "marketCode"
  | "currencyCode"
  | "location"
  | "budgetMin"
  | "budgetMax"
  | "shortletDuration";

export type PropertyRequestListScope = "owner" | "discover" | "admin";
export type PropertyRequestDiscoverFilters = {
  q: string | null;
  intent: PropertyRequestIntent | null;
  marketCode: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  moveTimeline: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  status: PropertyRequestStatus | null;
};

export type PropertyRequestRecord = {
  id: string;
  owner_user_id: string;
  owner_role: UserRole;
  intent: PropertyRequestIntent;
  market_code: string;
  currency_code: string;
  city: string | null;
  area: string | null;
  location_text: string | null;
  budget_min: number | null;
  budget_max: number | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: boolean | null;
  move_timeline: string | null;
  shortlet_duration: string | null;
  notes: string | null;
  status: PropertyRequestStatus;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PropertyRequest = {
  id: string;
  ownerUserId: string;
  ownerRole: UserRole;
  intent: PropertyRequestIntent;
  marketCode: string;
  currencyCode: string;
  city: string | null;
  area: string | null;
  locationText: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: boolean | null;
  moveTimeline: string | null;
  shortletDuration: string | null;
  notes: string | null;
  status: PropertyRequestStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const propertyRequestDraftSchema = z
  .object({
    intent: z.enum(PROPERTY_REQUEST_INTENTS).optional(),
    marketCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
    currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
    city: z.string().trim().min(1).max(80).nullable().optional(),
    area: z.string().trim().max(120).nullable().optional(),
    locationText: z.string().trim().max(160).nullable().optional(),
    budgetMin: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    budgetMax: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    propertyType: z.string().trim().max(64).nullable().optional(),
    bedrooms: z.number().int().min(0).max(20).nullable().optional(),
    bathrooms: z.number().int().min(0).max(20).nullable().optional(),
    furnished: z.boolean().nullable().optional(),
    moveTimeline: z.string().trim().max(80).nullable().optional(),
    shortletDuration: z.string().trim().max(80).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      typeof value.budgetMin === "number" &&
      typeof value.budgetMax === "number" &&
      value.budgetMax < value.budgetMin
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "budgetMax must be greater than or equal to budgetMin",
        path: ["budgetMax"],
      });
    }
  });

export const propertyRequestCreateSchema = propertyRequestDraftSchema.safeExtend({
  status: z.enum(["draft", "open"]).optional().default("draft"),
});
export type PropertyRequestCreateInput = z.infer<typeof propertyRequestCreateSchema>;
export const propertyRequestUpdateSchema = propertyRequestDraftSchema.safeExtend({
  status: z.enum(PROPERTY_REQUEST_OWNER_WRITE_STATUSES).optional(),
});
export type PropertyRequestUpdateInput = z.infer<typeof propertyRequestUpdateSchema>;

export function canRoleCreatePropertyRequests(role: UserRole | null | undefined): boolean {
  return role === "tenant";
}

export function canRoleBrowsePropertyRequests(role: UserRole | null | undefined): boolean {
  return role === "landlord" || role === "agent" || role === "admin";
}

export function resolvePropertyRequestListScope(
  role: UserRole | null | undefined
): PropertyRequestListScope | null {
  if (role === "tenant") return "owner";
  if (role === "landlord" || role === "agent") return "discover";
  if (role === "admin") return "admin";
  return null;
}

export function isPropertyRequestPublishedStatus(status: PropertyRequestStatus): boolean {
  return status !== "draft" && status !== "removed";
}

export function canOwnerWritePropertyRequestStatus(
  status: PropertyRequestStatus | null | undefined
): status is PropertyRequestOwnerWriteStatus {
  return status === "draft" || status === "open" || status === "closed";
}

export function isPropertyRequestDiscoverable(input: {
  role: UserRole | null | undefined;
  status: PropertyRequestStatus;
  publishedAt?: string | null;
  expiresAt?: string | null;
  now?: Date;
}): boolean {
  if (!canRoleBrowsePropertyRequests(input.role)) return false;
  if (input.role === "admin") return true;
  if (input.status !== "open") return false;
  if (!input.publishedAt) return false;
  if (!input.expiresAt) return true;
  const expiresAt = Date.parse(input.expiresAt);
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt > (input.now ?? new Date()).getTime();
}

export function canViewPropertyRequest(input: {
  role: UserRole | null | undefined;
  viewerUserId?: string | null;
  request: PropertyRequest | PropertyRequestRecord;
  now?: Date;
}): boolean {
  const request =
    "ownerUserId" in input.request ? input.request : mapPropertyRequestRecord(input.request);

  if (input.role === "admin") return true;
  if (input.viewerUserId && request.ownerUserId === input.viewerUserId) return true;
  return isPropertyRequestDiscoverable({
    role: input.role,
    status: request.status,
    publishedAt: request.publishedAt,
    expiresAt: request.expiresAt,
    now: input.now,
  });
}

export function resolvePropertyRequestPublishMissingFields(
  input: z.infer<typeof propertyRequestDraftSchema>
): PropertyRequestPublishMissingField[] {
  const missing: PropertyRequestPublishMissingField[] = [];
  if (!input.intent) missing.push("intent");
  if (!input.marketCode) missing.push("marketCode");
  if (!input.currencyCode) missing.push("currencyCode");
  if (!input.city && !input.locationText) missing.push("location");
  if (typeof input.budgetMin !== "number") missing.push("budgetMin");
  if (typeof input.budgetMax !== "number") missing.push("budgetMax");
  if (input.intent === "shortlet" && !input.shortletDuration) {
    missing.push("shortletDuration");
  }
  return missing;
}

export function resolvePropertyRequestLifecycleDates(input: {
  nextStatus: PropertyRequestOwnerWriteStatus;
  currentPublishedAt?: string | null;
  currentExpiresAt?: string | null;
  now: Date;
}): { publishedAt: string | null; expiresAt: string | null } {
  if (input.nextStatus === "draft") {
    return { publishedAt: null, expiresAt: null };
  }

  const publishedAt =
    input.currentPublishedAt && !Number.isNaN(Date.parse(input.currentPublishedAt))
      ? input.currentPublishedAt
      : input.now.toISOString();
  const expiresAt =
    input.currentExpiresAt && !Number.isNaN(Date.parse(input.currentExpiresAt))
      ? input.currentExpiresAt
      : new Date(
          input.now.getTime() + PROPERTY_REQUEST_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();

  return { publishedAt, expiresAt };
}

const PROPERTY_REQUEST_STATUS_LABELS: Record<PropertyRequestStatus, string> = {
  draft: "Draft",
  open: "Open",
  matched: "Matched",
  closed: "Closed",
  expired: "Expired",
  removed: "Removed",
};

const PROPERTY_REQUEST_INTENT_LABELS: Record<PropertyRequestIntent, string> = {
  rent: "Rent",
  buy: "Buy",
  shortlet: "Shortlet",
};
const PROPERTY_REQUEST_MOVE_TIMELINE_LABELS: Record<string, string> = {
  immediately: "Immediately",
  within_30_days: "Within 30 days",
  within_90_days: "Within 90 days",
  planning_ahead: "Planning ahead",
};

export function getPropertyRequestStatusLabel(status: PropertyRequestStatus): string {
  return PROPERTY_REQUEST_STATUS_LABELS[status];
}

export function getPropertyRequestIntentLabel(intent: PropertyRequestIntent): string {
  return PROPERTY_REQUEST_INTENT_LABELS[intent];
}

export function getPropertyRequestMoveTimelineLabel(moveTimeline: string | null | undefined): string {
  if (!moveTimeline) return "Flexible";
  return PROPERTY_REQUEST_MOVE_TIMELINE_LABELS[moveTimeline] ?? moveTimeline;
}

export function getPropertyRequestLocationSummary(input: {
  city?: string | null;
  area?: string | null;
  locationText?: string | null;
}): string {
  const parts = [input.area, input.city].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
  if (parts.length > 0) return parts.join(", ");
  if (input.locationText && input.locationText.trim().length > 0) {
    return input.locationText.trim();
  }
  return "Location not set";
}

export function mapPropertyRequestRecord(record: PropertyRequestRecord): PropertyRequest {
  return {
    id: record.id,
    ownerUserId: record.owner_user_id,
    ownerRole: record.owner_role,
    intent: record.intent,
    marketCode: record.market_code,
    currencyCode: record.currency_code,
    city: record.city,
    area: record.area,
    locationText: record.location_text,
    budgetMin: record.budget_min,
    budgetMax: record.budget_max,
    propertyType: record.property_type,
    bedrooms: record.bedrooms,
    bathrooms: record.bathrooms,
    furnished: record.furnished,
    moveTimeline: record.move_timeline,
    shortletDuration: record.shortlet_duration,
    notes: record.notes,
    status: record.status,
    publishedAt: record.published_at,
    expiresAt: record.expires_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function parseDiscoverNumeric(input: string | null | undefined): number | null {
  if (!input) return null;
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDiscoverText(input: string | null | undefined): string | null {
  const trimmed = input?.trim();
  return trimmed ? trimmed : null;
}

function readSearchValue(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
): string | null {
  if (input instanceof URLSearchParams) {
    return input.get(key);
  }
  const value = input[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function parsePropertyRequestDiscoverFilters(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): PropertyRequestDiscoverFilters {
  const intent = readSearchValue(input, "intent");
  const status = readSearchValue(input, "status");
  const parsedStatus =
    status && PROPERTY_REQUEST_STATUSES.includes(status as PropertyRequestStatus)
      ? (status as PropertyRequestStatus)
      : null;

  return {
    q: parseDiscoverText(readSearchValue(input, "q")),
    intent:
      intent && PROPERTY_REQUEST_INTENTS.includes(intent as PropertyRequestIntent)
        ? (intent as PropertyRequestIntent)
        : null,
    marketCode: parseDiscoverText(readSearchValue(input, "market"))?.toUpperCase() ?? null,
    propertyType: parseDiscoverText(readSearchValue(input, "propertyType")),
    bedrooms: parseDiscoverNumeric(readSearchValue(input, "bedrooms")),
    moveTimeline: parseDiscoverText(readSearchValue(input, "moveTimeline")),
    budgetMin: parseDiscoverNumeric(readSearchValue(input, "budgetMin")),
    budgetMax: parseDiscoverNumeric(readSearchValue(input, "budgetMax")),
    status: parsedStatus,
  };
}

export function matchesPropertyRequestDiscoverFilters(
  request: PropertyRequest,
  filters: PropertyRequestDiscoverFilters
): boolean {
  if (filters.intent && request.intent !== filters.intent) return false;
  if (filters.marketCode && request.marketCode !== filters.marketCode) return false;
  if (filters.propertyType && request.propertyType !== filters.propertyType) return false;
  if (typeof filters.bedrooms === "number" && request.bedrooms !== filters.bedrooms) return false;
  if (filters.moveTimeline && request.moveTimeline !== filters.moveTimeline) return false;
  if (filters.status && request.status !== filters.status) return false;

  if (typeof filters.budgetMin === "number") {
    const requestBudgetMax = request.budgetMax ?? request.budgetMin;
    if (typeof requestBudgetMax === "number" && requestBudgetMax < filters.budgetMin) {
      return false;
    }
  }

  if (typeof filters.budgetMax === "number") {
    const requestBudgetMin = request.budgetMin ?? request.budgetMax;
    if (typeof requestBudgetMin === "number" && requestBudgetMin > filters.budgetMax) {
      return false;
    }
  }

  if (filters.q) {
    const haystack = [request.city, request.area, request.locationText]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filters.q.toLowerCase())) return false;
  }

  return true;
}

export const PROPERTY_REQUEST_SELECT_COLUMNS = [
  "id",
  "owner_user_id",
  "owner_role",
  "intent",
  "market_code",
  "currency_code",
  "city",
  "area",
  "location_text",
  "budget_min",
  "budget_max",
  "property_type",
  "bedrooms",
  "bathrooms",
  "furnished",
  "move_timeline",
  "shortlet_duration",
  "notes",
  "status",
  "published_at",
  "expires_at",
  "created_at",
  "updated_at",
].join(", ");
