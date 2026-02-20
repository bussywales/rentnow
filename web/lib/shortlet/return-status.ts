export type ShortletBookingStatus =
  | "pending_payment"
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "expired"
  | "completed";

export type ShortletPaymentStatus =
  | "initiated"
  | "succeeded"
  | "failed"
  | "refunded";

export type ShortletReturnUiState =
  | "processing"
  | "finalising"
  | "pending"
  | "confirmed"
  | "failed"
  | "refunded"
  | "closed";

export const SHORTLET_STATUS_POLL_TIMEOUT_MS = 60_000;

export const SHORTLET_BOOKING_STATUS_VALUES = [
  "pending_payment",
  "pending",
  "confirmed",
  "declined",
  "cancelled",
  "expired",
  "completed",
] as const satisfies ReadonlyArray<ShortletBookingStatus>;

export const SHORTLET_PAYMENT_STATUS_VALUES = [
  "initiated",
  "succeeded",
  "failed",
  "refunded",
] as const satisfies ReadonlyArray<ShortletPaymentStatus>;

const TERMINAL_BOOKING_STATUSES = new Set<ShortletBookingStatus>([
  "pending",
  "confirmed",
  "declined",
  "cancelled",
  "expired",
  "completed",
]);

const TERMINAL_PAYMENT_STATUSES = new Set<ShortletPaymentStatus>([
  "succeeded",
  "failed",
  "refunded",
]);

const FAILURE_PAYMENT_STATUSES = new Set<ShortletPaymentStatus>([
  "failed",
  "refunded",
]);

export function normalizeShortletBookingStatus(
  status: string | null | undefined
): ShortletBookingStatus | null {
  const normalized = String(status || "").trim().toLowerCase();
  if (
    normalized === "pending_payment" ||
    normalized === "pending" ||
    normalized === "confirmed" ||
    normalized === "declined" ||
    normalized === "cancelled" ||
    normalized === "expired" ||
    normalized === "completed"
  ) {
    return normalized;
  }
  return null;
}

export function normalizeShortletPaymentStatus(
  status: string | null | undefined
): ShortletPaymentStatus | null {
  const normalized = String(status || "").trim().toLowerCase();
  if (
    normalized === "initiated" ||
    normalized === "succeeded" ||
    normalized === "failed" ||
    normalized === "refunded"
  ) {
    return normalized;
  }
  return null;
}

export function isTerminalBookingStatus(status: string | null | undefined) {
  const normalized = normalizeShortletBookingStatus(status);
  if (!normalized) return false;
  return TERMINAL_BOOKING_STATUSES.has(normalized);
}

export function isTerminalPaymentStatus(status: string | null | undefined) {
  const normalized = normalizeShortletPaymentStatus(status);
  if (!normalized) return false;
  return TERMINAL_PAYMENT_STATUSES.has(normalized);
}

export function isTerminalBooking(status: string | null | undefined) {
  return isTerminalBookingStatus(status);
}

export function isTerminalPayment(status: string | null | undefined) {
  return isTerminalPaymentStatus(status);
}

function isFailurePaymentStatus(status: string | null | undefined) {
  const normalized = normalizeShortletPaymentStatus(status);
  if (!normalized) return false;
  return FAILURE_PAYMENT_STATUSES.has(normalized);
}

/**
 * Booking status is authoritative for return-page polling.
 * Continue polling only while booking is pending_payment, except failed/refunded payments stop immediately.
 */
export function shouldPoll(input: {
  bookingStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  elapsedMs: number;
  timeoutMs?: number;
}) {
  if (isFailurePaymentStatus(input.paymentStatus)) {
    return false;
  }
  if (input.elapsedMs >= (input.timeoutMs ?? SHORTLET_STATUS_POLL_TIMEOUT_MS)) {
    return false;
  }
  const bookingStatus = normalizeShortletBookingStatus(input.bookingStatus);
  if (!bookingStatus) {
    return true;
  }
  return bookingStatus === "pending_payment";
}

export function shouldStopPolling(input: {
  bookingStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  elapsedMs: number;
  timeoutMs?: number;
}) {
  return !shouldPoll(input);
}

export function getPollingStopReason(input: {
  bookingStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  elapsedMs: number;
  timeoutMs?: number;
}) {
  if (isFailurePaymentStatus(input.paymentStatus)) {
    return "terminal_payment" as const;
  }
  if (input.elapsedMs >= (input.timeoutMs ?? SHORTLET_STATUS_POLL_TIMEOUT_MS)) {
    return "timeout" as const;
  }
  const bookingStatus = normalizeShortletBookingStatus(input.bookingStatus);
  if (bookingStatus && bookingStatus !== "pending_payment") {
    return "terminal_booking" as const;
  }
  return "continue" as const;
}

export function resolvePollingAction(input: {
  bookingStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  elapsedMs: number;
  timeoutMs?: number;
  timeoutFinalFetchDone: boolean;
}) {
  const timeoutMs = input.timeoutMs ?? SHORTLET_STATUS_POLL_TIMEOUT_MS;
  const shouldStop = shouldStopPolling({
    bookingStatus: input.bookingStatus,
    paymentStatus: input.paymentStatus,
    elapsedMs: input.elapsedMs,
    timeoutMs,
  });
  if (!shouldStop) return "continue" as const;
  if (input.elapsedMs >= timeoutMs) {
    return input.timeoutFinalFetchDone
      ? ("stop" as const)
      : ("final_fetch_then_wait_then_stop" as const);
  }
  return "stop" as const;
}

export function isShortletPaymentFinalisingState(input: {
  bookingStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
}) {
  const bookingStatus = normalizeShortletBookingStatus(input.bookingStatus);
  const paymentStatus = normalizeShortletPaymentStatus(input.paymentStatus);
  return bookingStatus === "pending_payment" && paymentStatus === "succeeded";
}

export function resolveShortletTimeoutMessage(input: {
  bookingStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
}) {
  if (isShortletPaymentFinalisingState(input)) {
    return "Payment received. Final confirmation is taking longer than usual. This does not mean your payment failed.";
  }
  return "Confirmation is taking longer than usual. Recheck now or contact support if this keeps happening.";
}

export function resolveShortletReturnUiState(input: {
  bookingStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
}) {
  const bookingStatus = normalizeShortletBookingStatus(input.bookingStatus);
  const paymentStatus = normalizeShortletPaymentStatus(input.paymentStatus);

  if (paymentStatus === "refunded") return "refunded" as const;
  if (isShortletPaymentFinalisingState({ bookingStatus, paymentStatus })) {
    return "finalising" as const;
  }
  if (bookingStatus === "confirmed") return "confirmed" as const;
  if (bookingStatus === "pending") return "pending" as const;
  if (bookingStatus && TERMINAL_BOOKING_STATUSES.has(bookingStatus)) {
    return "closed" as const;
  }
  if (paymentStatus === "failed") {
    return "failed" as const;
  }
  return "processing" as const;
}
