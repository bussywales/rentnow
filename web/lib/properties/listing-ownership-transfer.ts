import type { PropertyStatus, UserRole } from "@/lib/types";

export const LISTING_TRANSFER_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "expired",
] as const;

export type ListingTransferStatus = (typeof LISTING_TRANSFER_STATUSES)[number];

export const LISTING_TRANSFER_RECIPIENT_ROLES: UserRole[] = ["landlord", "agent"];

export const LISTING_TRANSFER_ENTITLEMENT_STATUSES: PropertyStatus[] = [
  "pending",
  "live",
  "expired",
  "paused_owner",
  "paused_occupied",
];

export const LISTING_TRANSFER_BLOCKING_SHORTLET_BOOKING_STATUSES = [
  "pending_payment",
  "pending",
  "confirmed",
] as const;

export const LISTING_TRANSFER_EXPIRY_DAYS = 7;

export function isListingTransferStatus(value: string | null | undefined): value is ListingTransferStatus {
  return LISTING_TRANSFER_STATUSES.includes(String(value || "").trim().toLowerCase() as ListingTransferStatus);
}

export function normalizeListingTransferStatus(
  value: string | null | undefined
): ListingTransferStatus | null {
  const normalized = String(value || "").trim().toLowerCase();
  return isListingTransferStatus(normalized) ? normalized : null;
}

export function resolveListingTransferRequiresEntitlement(
  status: PropertyStatus | string | null | undefined
) {
  const normalized = String(status || "").trim().toLowerCase() as PropertyStatus;
  return LISTING_TRANSFER_ENTITLEMENT_STATUSES.includes(normalized);
}

export function resolveListingTransferExpiresAt(now = new Date()) {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + LISTING_TRANSFER_EXPIRY_DAYS);
  return expiresAt.toISOString();
}

export function isListingTransferExpired(input: {
  status: ListingTransferStatus | string | null | undefined;
  expiresAt?: string | null | undefined;
  now?: Date;
}) {
  const status = normalizeListingTransferStatus(input.status);
  if (status && status !== "pending") return status === "expired";
  const raw = String(input.expiresAt || "").trim();
  if (!raw) return false;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return false;
  return parsed <= (input.now ?? new Date()).getTime();
}

export function resolveListingTransferStatusLabel(
  status: ListingTransferStatus | string | null | undefined
) {
  const normalized = normalizeListingTransferStatus(status);
  if (normalized === "pending") return "Pending transfer";
  if (normalized === "accepted") return "Transfer accepted";
  if (normalized === "rejected") return "Transfer rejected";
  if (normalized === "cancelled") return "Transfer cancelled";
  if (normalized === "expired") return "Transfer expired";
  return "Transfer";
}

export function formatListingTransferTargetRoleLabel(role: UserRole | string | null | undefined) {
  if (role === "landlord") return "Landlord";
  if (role === "agent") return "Agent";
  if (role === "admin") return "Admin";
  if (role === "tenant") return "Tenant";
  return "User";
}
