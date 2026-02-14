export type ShortletBookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "expired"
  | "completed";

export function canHostRespondToBooking(status: ShortletBookingStatus): boolean {
  return status === "pending";
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
