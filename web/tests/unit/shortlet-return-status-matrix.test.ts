import test from "node:test";
import assert from "node:assert/strict";
import {
  SHORTLET_BOOKING_STATUS_VALUES,
  SHORTLET_PAYMENT_STATUS_VALUES,
  type ShortletBookingStatus,
  type ShortletPaymentStatus,
  resolveShortletReturnUiState,
  shouldPoll,
} from "@/lib/shortlet/return-status";

const paymentStatuses: Array<ShortletPaymentStatus | null> = [
  null,
  ...SHORTLET_PAYMENT_STATUS_VALUES,
];

function expectedShouldPoll(
  bookingStatus: ShortletBookingStatus,
  paymentStatus: ShortletPaymentStatus | null
) {
  if (bookingStatus !== "pending_payment") {
    return false;
  }
  if (paymentStatus === "failed" || paymentStatus === "refunded") {
    return false;
  }
  return true;
}

function expectedUiState(
  bookingStatus: ShortletBookingStatus,
  paymentStatus: ShortletPaymentStatus | null
) {
  if (paymentStatus === "refunded") return "refunded";
  if (bookingStatus === "confirmed") return "confirmed";
  if (bookingStatus === "pending") return "pending";
  if (
    bookingStatus === "declined" ||
    bookingStatus === "cancelled" ||
    bookingStatus === "expired" ||
    bookingStatus === "completed"
  ) {
    return "closed";
  }
  if (paymentStatus === "failed") return "failed";
  return "processing";
}

void test("full polling matrix follows authoritative booking-first contract", () => {
  for (const bookingStatus of SHORTLET_BOOKING_STATUS_VALUES) {
    for (const paymentStatus of paymentStatuses) {
      const actual = shouldPoll({
        bookingStatus,
        paymentStatus,
        elapsedMs: 10_000,
      });
      const expected = expectedShouldPoll(bookingStatus, paymentStatus);

      assert.equal(
        actual,
        expected,
        `shouldPoll mismatch for booking=${bookingStatus} payment=${String(paymentStatus)}`
      );
    }
  }
});

void test("full UI-state matrix returns expected messaging state", () => {
  for (const bookingStatus of SHORTLET_BOOKING_STATUS_VALUES) {
    for (const paymentStatus of paymentStatuses) {
      const actual = resolveShortletReturnUiState({
        bookingStatus,
        paymentStatus,
      });
      const expected = expectedUiState(bookingStatus, paymentStatus);

      assert.equal(
        actual,
        expected,
        `ui state mismatch for booking=${bookingStatus} payment=${String(paymentStatus)}`
      );
    }
  }
});

void test("regression race: succeeded + pending_payment must keep polling", () => {
  assert.equal(
    shouldPoll({
      bookingStatus: "pending_payment",
      paymentStatus: "succeeded",
      elapsedMs: 5_000,
    }),
    true
  );
});
