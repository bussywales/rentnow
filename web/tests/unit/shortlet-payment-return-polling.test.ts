import test from "node:test";
import assert from "node:assert/strict";
import { resolveReturnUiState, shouldPollStatus } from "@/components/payments/ShortletPaymentReturnStatus";

void test("shouldPollStatus keeps polling while payment is still processing", () => {
  const result = shouldPollStatus("initiated", "pending_payment", 5_000);
  assert.equal(result, true);
});

void test("shouldPollStatus keeps polling when payment succeeded but booking still pending_payment", () => {
  const result = shouldPollStatus("succeeded", "pending_payment", 10_000);
  assert.equal(result, true);
});

void test("shouldPollStatus stops after successful transition", () => {
  assert.equal(shouldPollStatus("succeeded", "pending", 10_000), false);
  assert.equal(shouldPollStatus("succeeded", "confirmed", 10_000), false);
});

void test("shouldPollStatus stops when booking moved to pending and UI becomes waiting for host approval", () => {
  assert.equal(shouldPollStatus("initiated", "pending", 10_000), false);
  assert.equal(
    resolveReturnUiState({
      paymentStatus: "initiated",
      bookingStatus: "pending",
      hasPayment: true,
    }),
    "pending"
  );
});

void test("shouldPollStatus stops on payment failure while booking is still pending_payment", () => {
  assert.equal(shouldPollStatus("failed", "pending_payment", 10_000), false);
  assert.equal(
    resolveReturnUiState({
      paymentStatus: "failed",
      bookingStatus: "pending_payment",
      hasPayment: true,
    }),
    "failed"
  );
});

void test("shouldPollStatus treats refunded as terminal for any booking state", () => {
  assert.equal(shouldPollStatus("refunded", "pending_payment", 10_000), false);
  assert.equal(shouldPollStatus("refunded", "confirmed", 10_000), false);
  assert.equal(
    resolveReturnUiState({
      paymentStatus: "refunded",
      bookingStatus: "confirmed",
      hasPayment: true,
    }),
    "failed"
  );
});

void test("shouldPollStatus stops when timeout is reached", () => {
  const result = shouldPollStatus("initiated", "pending_payment", 60_000);
  assert.equal(result, false);
});
