import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPendingHold,
  calculateAvailableCredits,
  validateCashoutGuard,
} from "@/lib/referrals/cashout";

const enabledPolicy = {
  payouts_enabled: true,
  conversion_enabled: true,
  credit_to_cash_rate: 50,
  min_cashout_credits: 5,
  monthly_cashout_cap_amount: 2000,
};

void test("cashout guards reject disabled countries", () => {
  const result = validateCashoutGuard({
    policy: {
      ...enabledPolicy,
      payouts_enabled: false,
    },
    creditsRequested: 10,
    availableCredits: 100,
    monthToDateCashAmount: 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "CASHOUT_DISABLED");
});

void test("cashout guards enforce minimum credits", () => {
  const result = validateCashoutGuard({
    policy: enabledPolicy,
    creditsRequested: 3,
    availableCredits: 100,
    monthToDateCashAmount: 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "BELOW_MIN_CASHOUT");
});

void test("cashout guards enforce available credits and monthly caps", () => {
  const insufficient = validateCashoutGuard({
    policy: enabledPolicy,
    creditsRequested: 20,
    availableCredits: 10,
    monthToDateCashAmount: 0,
  });
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.reason, "INSUFFICIENT_CREDITS");

  const overCap = validateCashoutGuard({
    policy: enabledPolicy,
    creditsRequested: 20,
    availableCredits: 50,
    monthToDateCashAmount: 1500,
  });
  assert.equal(overCap.ok, false);
  assert.equal(overCap.reason, "MONTHLY_CAP_EXCEEDED");
});

void test("pending holds lock credits and idempotent hold replay does not double-lock", () => {
  const totalBalance = 20;
  const firstHeld = applyPendingHold(0, 10);
  assert.equal(firstHeld, 10);

  const replayHeld = applyPendingHold(firstHeld, 10, { alreadyHeld: true });
  assert.equal(replayHeld, 10);

  const available = calculateAvailableCredits(totalBalance, replayHeld);
  assert.equal(available, 10);

  const blocked = validateCashoutGuard({
    policy: enabledPolicy,
    creditsRequested: 11,
    availableCredits: available,
    monthToDateCashAmount: 0,
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "INSUFFICIENT_CREDITS");
});
