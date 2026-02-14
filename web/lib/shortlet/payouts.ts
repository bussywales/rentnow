export type ShortletPayoutStatus = "eligible" | "paid";

export function resolveMarkPaidTransition(
  currentStatus: string | null | undefined
): "mark_paid" | "already_paid" | "blocked" {
  const normalized = String(currentStatus || "").toLowerCase();
  if (normalized === "eligible") return "mark_paid";
  if (normalized === "paid") return "already_paid";
  return "blocked";
}

export function isBookingEligibleForPayout(input: {
  bookingStatus: string | null | undefined;
  checkOut: string | null | undefined;
  nowMs?: number;
}): boolean {
  const status = String(input.bookingStatus || "").toLowerCase();
  if (status === "completed") return true;
  if (status !== "confirmed") return false;
  const checkOutMs = Date.parse(String(input.checkOut || ""));
  const nowMs = input.nowMs ?? Date.now();
  return Number.isFinite(checkOutMs) && checkOutMs <= nowMs;
}
