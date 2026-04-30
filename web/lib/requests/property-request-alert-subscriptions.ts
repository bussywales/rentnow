import { z } from "zod";
import {
  PROPERTY_REQUEST_INTENTS,
  shouldShowPropertyRequestBedrooms,
  type PropertyRequest,
} from "@/lib/requests/property-requests";
import type { PropertyRequestResponderRole } from "@/lib/requests/property-requests";
import type { UserRole } from "@/lib/types";

export const PROPERTY_REQUEST_ALERT_ELIGIBLE_ROLES = ["agent", "landlord"] as const;
export type PropertyRequestAlertEligibleRole =
  (typeof PROPERTY_REQUEST_ALERT_ELIGIBLE_ROLES)[number];

export type PropertyRequestAlertSubscriptionRecord = {
  id: string;
  user_id: string;
  role: PropertyRequestResponderRole;
  market_code: string;
  intent: string | null;
  property_type: string | null;
  city: string | null;
  bedrooms_min: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PropertyRequestAlertSubscription = {
  id: string;
  userId: string;
  role: PropertyRequestResponderRole;
  marketCode: string;
  intent: string | null;
  propertyType: string | null;
  city: string | null;
  bedroomsMin: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const PROPERTY_REQUEST_ALERT_SUBSCRIPTION_SELECT_COLUMNS = [
  "id",
  "user_id",
  "role",
  "market_code",
  "intent",
  "property_type",
  "city",
  "bedrooms_min",
  "is_active",
  "created_at",
  "updated_at",
].join(", ");

export const propertyRequestAlertSubscriptionCreateSchema = z.object({
  marketCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  intent: z.enum(PROPERTY_REQUEST_INTENTS).nullable().optional(),
  propertyType: z.string().trim().max(64).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  bedroomsMin: z.number().int().min(0).max(20).nullable().optional(),
});

export type PropertyRequestAlertSubscriptionCreateInput = z.infer<
  typeof propertyRequestAlertSubscriptionCreateSchema
>;

function normalizeNullableString(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCity(value: string | null | undefined) {
  return normalizeNullableString(value)?.toLowerCase() ?? null;
}

export function isPropertyRequestAlertEligibleRole(
  role: UserRole | null | undefined
): role is PropertyRequestAlertEligibleRole {
  return role === "agent" || role === "landlord";
}

export function mapPropertyRequestAlertSubscriptionRecord(
  row: PropertyRequestAlertSubscriptionRecord
): PropertyRequestAlertSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    marketCode: row.market_code,
    intent: normalizeNullableString(row.intent),
    propertyType: normalizeNullableString(row.property_type),
    city: normalizeNullableString(row.city),
    bedroomsMin: typeof row.bedrooms_min === "number" ? row.bedrooms_min : null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizePropertyRequestAlertSubscriptionInput(
  input: PropertyRequestAlertSubscriptionCreateInput
) {
  return {
    marketCode: input.marketCode,
    intent: normalizeNullableString(input.intent),
    propertyType: normalizeNullableString(input.propertyType),
    city: normalizeNullableString(input.city),
    bedroomsMin: typeof input.bedroomsMin === "number" ? input.bedroomsMin : null,
  };
}

export function arePropertyRequestAlertSubscriptionCriteriaEqual(
  left: Pick<
    PropertyRequestAlertSubscription,
    "role" | "marketCode" | "intent" | "propertyType" | "city" | "bedroomsMin"
  >,
  right: Pick<
    PropertyRequestAlertSubscription,
    "role" | "marketCode" | "intent" | "propertyType" | "city" | "bedroomsMin"
  >
) {
  return (
    left.role === right.role &&
    left.marketCode === right.marketCode &&
    normalizeNullableString(left.intent) === normalizeNullableString(right.intent) &&
    normalizeNullableString(left.propertyType) === normalizeNullableString(right.propertyType) &&
    normalizeCity(left.city) === normalizeCity(right.city) &&
    (left.bedroomsMin ?? null) === (right.bedroomsMin ?? null)
  );
}

export function doesPropertyRequestMatchAlertSubscription(
  request: PropertyRequest,
  subscription: Pick<
    PropertyRequestAlertSubscription,
    "marketCode" | "intent" | "propertyType" | "city" | "bedroomsMin"
  >
) {
  if (request.marketCode !== subscription.marketCode) return false;

  const subscriptionIntent = normalizeNullableString(subscription.intent);
  if (subscriptionIntent && request.intent !== subscriptionIntent) return false;

  const subscriptionPropertyType = normalizeNullableString(subscription.propertyType);
  if (subscriptionPropertyType && request.propertyType !== subscriptionPropertyType) return false;

  const subscriptionCity = normalizeCity(subscription.city);
  if (subscriptionCity && normalizeCity(request.city) !== subscriptionCity) return false;

  if (typeof subscription.bedroomsMin === "number") {
    if (!shouldShowPropertyRequestBedrooms(request.propertyType)) return false;
    if (typeof request.bedrooms !== "number") return false;
    if (request.bedrooms < subscription.bedroomsMin) return false;
  }

  return true;
}
