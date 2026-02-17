import test from "node:test";
import assert from "node:assert/strict";
import { shouldPollStatus } from "@/components/payments/ShortletPaymentReturnStatus";

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

void test("shouldPollStatus stops when timeout is reached", () => {
  const result = shouldPollStatus("initiated", "pending_payment", 60_000);
  assert.equal(result, false);
});
