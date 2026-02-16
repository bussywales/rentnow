export type ShortletBookingStatus =
  | "pending_payment"
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "expired"
  | "completed";
export type HostBookingDecision = "approve" | "decline";
export type HostBookingRespondAction = "accept" | "decline";

export function canHostRespondToBooking(status: ShortletBookingStatus): boolean {
  return status === "pending";
}

export function blocksAvailability(status: ShortletBookingStatus): boolean {
  return status === "pending" || status === "confirmed";
}

export function canCancelBooking(status: ShortletBookingStatus): boolean {
  return status === "pending_payment" || status === "pending" || status === "confirmed";
}

export function resolveHostBookingResponseStatus(
  currentStatus: ShortletBookingStatus,
  action: "accept" | "decline"
): ShortletBookingStatus {
  if (!canHostRespondToBooking(currentStatus)) {
    throw new Error("INVALID_STATUS_TRANSITION");
  }
  return action === "accept" ? "confirmed" : "declined";
}

export function mapHostBookingDecisionToAction(
  decision: HostBookingDecision
): HostBookingRespondAction {
  return decision === "approve" ? "accept" : "decline";
}

export function resolveHostBookingDecisionStatus(
  currentStatus: ShortletBookingStatus,
  decision: HostBookingDecision
): ShortletBookingStatus {
  return resolveHostBookingResponseStatus(
    currentStatus,
    mapHostBookingDecisionToAction(decision)
  );
}

export function mapBookingCreateError(message: string): { status: number; error: string } {
  const normalized = String(message || "").toUpperCase();
  if (
    normalized.includes("DATES_UNAVAILABLE") ||
    normalized.includes("DATES_BLOCKED") ||
    normalized.includes("SHORTLET_BOOKINGS_NO_OVERLAP") ||
    normalized.includes("EXCLUSION CONSTRAINT")
  ) {
    return {
      status: 409,
      error: "Selected dates are no longer available. Please choose different dates.",
    };
  }
  if (
    normalized.includes("INVALID_DATES") ||
    normalized.includes("INVALID_NIGHTS") ||
    normalized.includes("MIN_NIGHTS") ||
    normalized.includes("MAX_NIGHTS") ||
    normalized.includes("ADVANCE_NOTICE") ||
    normalized.includes("SHORTLET") ||
    normalized.includes("NIGHTLY_PRICE_REQUIRED")
  ) {
    return { status: 409, error: message };
  }
  return { status: 500, error: message || "Unable to create booking" };
}
