import test from "node:test";
import assert from "node:assert/strict";
import { validateCashoutActionTransition } from "@/lib/referrals/cashout-admin.server";

void test("approve is blocked once request is no longer pending", () => {
  const result = validateCashoutActionTransition({
    action: "approve",
    currentStatus: "approved",
    queueStatus: "approved",
    reason: null,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

void test("held request approval requires reason", () => {
  const missingReason = validateCashoutActionTransition({
    action: "approve",
    currentStatus: "pending",
    queueStatus: "held",
    reason: "",
  });
  assert.equal(missingReason.ok, false);
  if (!missingReason.ok) assert.equal(missingReason.status, 422);

  const withReason = validateCashoutActionTransition({
    action: "approve",
    currentStatus: "pending",
    queueStatus: "held",
    reason: "Manual review required",
  });
  assert.equal(withReason.ok, true);
});

void test("held requests cannot be bulk approved", () => {
  const result = validateCashoutActionTransition({
    action: "approve",
    currentStatus: "pending",
    queueStatus: "held",
    reason: "Manual review required",
    isBulk: true,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

void test("rejection and paid transitions enforce status and reason rules", () => {
  const rejectWithoutReason = validateCashoutActionTransition({
    action: "reject",
    currentStatus: "pending",
    queueStatus: "pending",
    reason: "",
  });
  assert.equal(rejectWithoutReason.ok, false);
  if (!rejectWithoutReason.ok) assert.equal(rejectWithoutReason.status, 422);

  const rejectWithReason = validateCashoutActionTransition({
    action: "reject",
    currentStatus: "pending",
    queueStatus: "pending",
    reason: "Suspicious activity",
  });
  assert.equal(rejectWithReason.ok, true);

  const markPaidInvalid = validateCashoutActionTransition({
    action: "paid",
    currentStatus: "pending",
    queueStatus: "pending",
    reason: null,
  });
  assert.equal(markPaidInvalid.ok, false);
  if (!markPaidInvalid.ok) assert.equal(markPaidInvalid.status, 409);
});
