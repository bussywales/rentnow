import { isBookingEligibleForPayout } from "@/lib/shortlet/payouts";
import {
  normalizeShortletBookingStatus,
  normalizeShortletPaymentStatus,
  type ShortletBookingStatus,
  type ShortletPaymentStatus,
} from "@/lib/shortlet/return-status";
import { groupMoneyByCurrency, type CurrencyMinorTotals } from "@/lib/money/multi-currency";

export type HostEarningsTimelineBookingRow = {
  bookingId: string;
  propertyId: string;
  title: string;
  city: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  bookingStatus: ShortletBookingStatus;
  totalMinor: number;
  currency: string;
  pricingSnapshot: Record<string, unknown>;
};

export type HostEarningsTimelinePaymentRow = {
  bookingId: string;
  status: ShortletPaymentStatus | null;
};

export type HostEarningsTimelinePayoutRow = {
  bookingId: string;
  amountMinor: number;
  status: "eligible" | "paid";
  paidAt: string | null;
  paidMethod: string | null;
  paidReference: string | null;
  requestedAt: string | null;
  requestedByUserId: string | null;
  requestedMethod: string | null;
  requestedNote: string | null;
};

export type HostEarningsTimelineItem = {
  bookingId: string;
  propertyId: string;
  title: string;
  city?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  bookingStatus: ShortletBookingStatus;
  paymentStatus: ShortletPaymentStatus | null;
  totalMinor: number;
  feesMinor?: number;
  hostEarningsMinor: number;
  currency: string;
  payoutStatus: "not_eligible" | "pending" | "paid";
  payoutReason?: string;
  payoutRequestStatus?: "requested" | "not_requested";
  payoutRequestedAt?: string;
  payoutRequestedMethod?: string;
  payoutRequestedNote?: string;
  paidAt?: string;
  payoutMethod?: string;
  payoutReference?: string;
};

export type HostEarningsTimelineSummary = {
  pendingApprovalCount: number;
  upcomingCount: number;
  inProgressCount: number;
  completedUnpaidCount: number;
  paidCount: number;
  grossEarningsMinor: number;
  paidOutMinor: number;
  availableToPayoutMinor: number;
  grossEarningsByCurrencyMinor: CurrencyMinorTotals;
  paidOutByCurrencyMinor: CurrencyMinorTotals;
  availableToPayoutByCurrencyMinor: CurrencyMinorTotals;
};

export type HostEarningsTimeline = {
  summary: HostEarningsTimelineSummary;
  items: HostEarningsTimelineItem[];
};

function toSafeMinor(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const minor = Math.trunc(numeric);
  if (minor < 0) return 0;
  return minor;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function pickMinorValue(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = toSafeMinor(source[key]);
    if (value !== null) return value;
  }
  return null;
}

function resolveFeesMinor(snapshotInput: Record<string, unknown>, totalMinor: number) {
  const snapshot = asRecord(snapshotInput);
  const directFee =
    pickMinorValue(snapshot, [
      "platform_fee_minor",
      "platformFeeMinor",
      "service_fee_minor",
      "serviceFeeMinor",
      "fee_total_minor",
      "feeTotalMinor",
      "fees_minor",
      "feesMinor",
    ]) ?? null;
  if (directFee !== null) return Math.min(directFee, totalMinor);

  const feeBreakdown = asRecord(snapshot.fee_breakdown ?? snapshot.feeBreakdown ?? null);
  const serviceFee =
    toSafeMinor(feeBreakdown.service_fee_minor ?? feeBreakdown.serviceFeeMinor ?? feeBreakdown.serviceFee) ?? 0;
  const cleaningFee =
    toSafeMinor(feeBreakdown.cleaning_fee_minor ?? feeBreakdown.cleaningFeeMinor ?? feeBreakdown.cleaningFee) ?? 0;
  const taxes = toSafeMinor(feeBreakdown.taxes_minor ?? feeBreakdown.taxesMinor ?? feeBreakdown.taxes) ?? 0;
  const fromBreakdown = serviceFee + cleaningFee + taxes;
  if (fromBreakdown > 0) {
    return Math.min(fromBreakdown, totalMinor);
  }

  const subtotal = toSafeMinor(snapshot.subtotal_minor ?? snapshot.subtotalMinor);
  if (subtotal !== null && subtotal <= totalMinor) {
    return totalMinor - subtotal;
  }

  return 0;
}

function resolveHostEarningsMinor(input: {
  totalMinor: number;
  payoutAmountMinor: number | null;
  pricingSnapshot: Record<string, unknown>;
}) {
  if (typeof input.payoutAmountMinor === "number" && input.payoutAmountMinor >= 0) {
    return Math.trunc(input.payoutAmountMinor);
  }

  const snapshot = asRecord(input.pricingSnapshot);
  const explicitHostEarnings = pickMinorValue(snapshot, [
    "host_earnings_minor",
    "hostEarningsMinor",
    "host_payout_minor",
    "hostPayoutMinor",
  ]);
  if (explicitHostEarnings !== null) {
    return Math.min(explicitHostEarnings, input.totalMinor);
  }

  const feesMinor = resolveFeesMinor(snapshot, input.totalMinor);
  const value = input.totalMinor - feesMinor;
  return value > 0 ? value : 0;
}

function resolvePayoutReason(input: {
  bookingStatus: ShortletBookingStatus;
  paymentStatus: ShortletPaymentStatus | null;
  bookingEligibleForPayout: boolean;
}) {
  if (input.bookingStatus === "pending") return "Booking pending approval";
  if (input.bookingStatus === "pending_payment") return "Payment not confirmed";
  if (
    input.paymentStatus === null ||
    input.paymentStatus === "initiated" ||
    input.paymentStatus === "failed" ||
    input.paymentStatus === "refunded"
  ) {
    return "Payment not confirmed";
  }
  if (!input.bookingEligibleForPayout) {
    return "Stay not completed";
  }
  return "Not yet eligible for payout";
}

function dateKeyFromIso(value: string) {
  return String(value || "").slice(0, 10);
}

function isInProgressWindow(input: { checkIn: string; checkOut: string; todayKey: string }) {
  const checkIn = dateKeyFromIso(input.checkIn);
  const checkOut = dateKeyFromIso(input.checkOut);
  if (!checkIn || !checkOut) return false;
  return checkIn <= input.todayKey && checkOut > input.todayKey;
}

export function buildHostEarningsTimeline(input: {
  bookings: HostEarningsTimelineBookingRow[];
  payments: HostEarningsTimelinePaymentRow[];
  payouts: HostEarningsTimelinePayoutRow[];
  now?: Date;
}): HostEarningsTimeline {
  const paymentByBookingId = new Map<string, ShortletPaymentStatus | null>();
  for (const payment of input.payments) {
    if (!payment.bookingId || paymentByBookingId.has(payment.bookingId)) continue;
    paymentByBookingId.set(payment.bookingId, payment.status);
  }

  const payoutByBookingId = new Map<string, HostEarningsTimelinePayoutRow>();
  for (const payout of input.payouts) {
    if (!payout.bookingId || payoutByBookingId.has(payout.bookingId)) continue;
    payoutByBookingId.set(payout.bookingId, payout);
  }

  const now = input.now ?? new Date();
  const todayKey = dateKeyFromIso(now.toISOString());
  const items = input.bookings.map((booking) => {
    const paymentStatus = paymentByBookingId.get(booking.bookingId) ?? null;
    const payout = payoutByBookingId.get(booking.bookingId) ?? null;
    const bookingEligibleForPayout = isBookingEligibleForPayout({
      bookingStatus: booking.bookingStatus,
      checkOut: booking.checkOut,
      nowMs: now.getTime(),
    });

    const hostEarningsMinor = resolveHostEarningsMinor({
      totalMinor: booking.totalMinor,
      payoutAmountMinor: payout?.amountMinor ?? null,
      pricingSnapshot: booking.pricingSnapshot,
    });
    const feesMinor = Math.max(0, booking.totalMinor - hostEarningsMinor);

    const payoutStatus: HostEarningsTimelineItem["payoutStatus"] =
      payout?.status === "paid"
        ? "paid"
        : bookingEligibleForPayout && paymentStatus === "succeeded"
          ? "pending"
          : "not_eligible";

    const payoutReason =
      payoutStatus === "not_eligible"
        ? resolvePayoutReason({
            bookingStatus: booking.bookingStatus,
            paymentStatus,
            bookingEligibleForPayout,
          })
        : undefined;
    const payoutRequestStatus: HostEarningsTimelineItem["payoutRequestStatus"] =
      payoutStatus === "pending"
        ? payout?.requestedAt
          ? "requested"
          : "not_requested"
        : undefined;

    return {
      bookingId: booking.bookingId,
      propertyId: booking.propertyId,
      title: booking.title,
      city: booking.city ?? undefined,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: booking.nights,
      bookingStatus: booking.bookingStatus,
      paymentStatus,
      totalMinor: booking.totalMinor,
      feesMinor,
      hostEarningsMinor,
      currency: booking.currency,
      payoutStatus,
      payoutReason,
      payoutRequestStatus,
      payoutRequestedAt: payout?.requestedAt ?? undefined,
      payoutRequestedMethod: payout?.requestedMethod ?? undefined,
      payoutRequestedNote: payout?.requestedNote ?? undefined,
      paidAt: payout?.paidAt ?? undefined,
      payoutMethod: payout?.paidMethod ?? undefined,
      payoutReference: payout?.paidReference ?? undefined,
    };
  });

  const summaryBase = items.reduce<
    Pick<
      HostEarningsTimelineSummary,
      | "pendingApprovalCount"
      | "upcomingCount"
      | "inProgressCount"
      | "completedUnpaidCount"
      | "paidCount"
      | "grossEarningsMinor"
      | "paidOutMinor"
      | "availableToPayoutMinor"
    >
  >(
    (acc, item) => {
      const checkInKey = dateKeyFromIso(item.checkIn);
      if (item.bookingStatus === "pending") {
        acc.pendingApprovalCount += 1;
      }
      if (item.bookingStatus === "confirmed" && checkInKey > todayKey) {
        acc.upcomingCount += 1;
      }
      if (
        item.bookingStatus === "confirmed" &&
        isInProgressWindow({
          checkIn: item.checkIn,
          checkOut: item.checkOut,
          todayKey,
        })
      ) {
        acc.inProgressCount += 1;
      }
      if (item.payoutStatus === "pending") {
        acc.completedUnpaidCount += 1;
        acc.availableToPayoutMinor += item.hostEarningsMinor;
      }
      if (item.payoutStatus === "paid") {
        acc.paidCount += 1;
        acc.paidOutMinor += item.hostEarningsMinor;
      }
      acc.grossEarningsMinor += item.hostEarningsMinor;
      return acc;
    },
    {
      pendingApprovalCount: 0,
      upcomingCount: 0,
      inProgressCount: 0,
      completedUnpaidCount: 0,
      paidCount: 0,
      grossEarningsMinor: 0,
      paidOutMinor: 0,
      availableToPayoutMinor: 0,
    }
  );

  const grossEarningsByCurrencyMinor = groupMoneyByCurrency(items, (item) => item.hostEarningsMinor);
  const paidOutByCurrencyMinor = groupMoneyByCurrency(
    items.filter((item) => item.payoutStatus === "paid"),
    (item) => item.hostEarningsMinor
  );
  const availableToPayoutByCurrencyMinor = groupMoneyByCurrency(
    items.filter((item) => item.payoutStatus === "pending"),
    (item) => item.hostEarningsMinor
  );

  const summary: HostEarningsTimelineSummary = {
    ...summaryBase,
    grossEarningsByCurrencyMinor,
    paidOutByCurrencyMinor,
    availableToPayoutByCurrencyMinor,
  };

  return {
    summary,
    items,
  };
}

export function normalizeTimelineBookingStatus(status: string | null | undefined) {
  return normalizeShortletBookingStatus(status);
}

export function normalizeTimelinePaymentStatus(status: string | null | undefined) {
  return normalizeShortletPaymentStatus(status);
}
