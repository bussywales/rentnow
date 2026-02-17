import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePollingAction,
  resolveShortletReturnUiState,
  shouldStopPolling,
} from "@/lib/shortlet/return-status";

void test("shouldStopPolling returns false for succeeded + pending_payment race", () => {
  const result = shouldStopPolling({
    paymentStatus: "succeeded",
    bookingStatus: "pending_payment",
    elapsedMs: 10_000,
  });
  assert.equal(result, false);
});

void test("shouldStopPolling stops whenever booking is terminal", () => {
  const terminalBookingStatuses = [
    "confirmed",
    "declined",
    "cancelled",
    "expired",
    "completed",
  ] as const;
  for (const bookingStatus of terminalBookingStatuses) {
    assert.equal(
      shouldStopPolling({
        paymentStatus: "initiated",
        bookingStatus,
        elapsedMs: 5_000,
      }),
      true
    );
  }
});

void test("shouldStopPolling stops for payment failed/refunded", () => {
  assert.equal(
    shouldStopPolling({
      paymentStatus: "failed",
      bookingStatus: "pending_payment",
      elapsedMs: 5_000,
    }),
    true
  );
  assert.equal(
    shouldStopPolling({
      paymentStatus: "refunded",
      bookingStatus: "pending",
      elapsedMs: 5_000,
    }),
    true
  );
});

void test("timeout triggers one final fetch action, then stop", () => {
  assert.equal(
    resolvePollingAction({
      paymentStatus: "initiated",
      bookingStatus: "pending_payment",
      elapsedMs: 60_000,
      timeoutFinalFetchDone: false,
    }),
    "final_fetch_then_stop"
  );
  assert.equal(
    resolvePollingAction({
      paymentStatus: "initiated",
      bookingStatus: "pending_payment",
      elapsedMs: 60_000,
      timeoutFinalFetchDone: true,
    }),
    "stop"
  );
});

void test("pending booking maps to waiting-for-host UI", () => {
  assert.equal(
    resolveShortletReturnUiState({
      paymentStatus: "initiated",
      bookingStatus: "pending",
    }),
    "pending"
  );
});
