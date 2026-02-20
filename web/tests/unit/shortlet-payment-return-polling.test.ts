import test from "node:test";
import assert from "node:assert/strict";
import {
  SHORTLET_BOOKING_STATUS_VALUES,
  SHORTLET_PAYMENT_STATUS_VALUES,
  resolvePollingAction,
  resolveShortletReturnUiState,
  resolveShortletTimeoutMessage,
  shouldPoll,
} from "@/lib/shortlet/return-status";

void test("status mapping arrays stay in sync with contract", () => {
  assert.deepEqual(SHORTLET_BOOKING_STATUS_VALUES, [
    "pending_payment",
    "pending",
    "confirmed",
    "declined",
    "cancelled",
    "expired",
    "completed",
  ]);
  assert.deepEqual(SHORTLET_PAYMENT_STATUS_VALUES, [
    "initiated",
    "succeeded",
    "failed",
    "refunded",
  ]);
});

void test("shouldPoll keeps polling for succeeded + pending_payment race", () => {
  assert.equal(
    shouldPoll({
      paymentStatus: "succeeded",
      bookingStatus: "pending_payment",
      elapsedMs: 10_000,
    }),
    true
  );
});

void test("shouldPoll stops when booking is pending (awaiting host approval)", () => {
  assert.equal(
    shouldPoll({
      paymentStatus: "initiated",
      bookingStatus: "pending",
      elapsedMs: 10_000,
    }),
    false
  );
  assert.equal(
    shouldPoll({
      paymentStatus: "succeeded",
      bookingStatus: "pending",
      elapsedMs: 10_000,
    }),
    false
  );
});

void test("shouldPoll stops for failed and refunded payments", () => {
  assert.equal(
    shouldPoll({
      paymentStatus: "failed",
      bookingStatus: "pending_payment",
      elapsedMs: 5_000,
    }),
    false
  );
  assert.equal(
    shouldPoll({
      paymentStatus: "refunded",
      bookingStatus: "pending_payment",
      elapsedMs: 5_000,
    }),
    false
  );
});

void test("shouldPoll table-driven combinations follow authoritative booking rule", () => {
  for (const bookingStatus of SHORTLET_BOOKING_STATUS_VALUES) {
    for (const paymentStatus of SHORTLET_PAYMENT_STATUS_VALUES) {
      const expected =
        (paymentStatus === "failed" || paymentStatus === "refunded")
          ? false
          : bookingStatus === "pending_payment";

      assert.equal(
        shouldPoll({
          bookingStatus,
          paymentStatus,
          elapsedMs: 1_000,
        }),
        expected,
        `Expected shouldPoll(${bookingStatus}, ${paymentStatus}) === ${expected}`
      );
    }
  }
});

void test("timeout triggers one final fetch action, then stop", () => {
  assert.equal(
    resolvePollingAction({
      paymentStatus: "initiated",
      bookingStatus: "pending_payment",
      elapsedMs: 60_000,
      timeoutFinalFetchDone: false,
    }),
    "final_fetch_then_wait_then_stop"
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

void test("return UI state maps pending host-approval and terminal states correctly", () => {
  assert.equal(
    resolveShortletReturnUiState({
      paymentStatus: "succeeded",
      bookingStatus: "pending",
    }),
    "pending"
  );
  assert.equal(
    resolveShortletReturnUiState({
      paymentStatus: "succeeded",
      bookingStatus: "pending_payment",
    }),
    "finalising"
  );
  assert.equal(
    resolveShortletReturnUiState({
      paymentStatus: "succeeded",
      bookingStatus: "confirmed",
    }),
    "confirmed"
  );
  assert.equal(
    resolveShortletReturnUiState({
      paymentStatus: "failed",
      bookingStatus: "pending_payment",
    }),
    "failed"
  );

  for (const bookingStatus of ["declined", "cancelled", "expired", "completed"] as const) {
    assert.equal(
      resolveShortletReturnUiState({
        paymentStatus: "succeeded",
        bookingStatus,
      }),
      "closed"
    );
  }
});

void test("timeout copy keeps confidence when payment already succeeded", () => {
  assert.match(
    resolveShortletTimeoutMessage({
      bookingStatus: "pending_payment",
      paymentStatus: "succeeded",
    }),
    /does not mean your payment failed/i
  );

  assert.match(
    resolveShortletTimeoutMessage({
      bookingStatus: "pending_payment",
      paymentStatus: "initiated",
    }),
    /taking longer than usual/i
  );
});
