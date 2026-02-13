import test from "node:test";
import assert from "node:assert/strict";
import { buildVerificationCenterState, isVerificationCompleteForRequirements } from "@/lib/verification/center";

void test("verification center state treats unknown fields as not verified", () => {
  const state = buildVerificationCenterState({
    status: {
      email: { verified: false },
      phone: { verified: false },
      bank: { verified: false },
    },
    requirements: {
      requireEmail: true,
      requirePhone: false,
      requireBank: false,
    },
  });

  assert.equal(state.steps.email.statusLabel, "Not verified");
  assert.equal(state.steps.phone.statusLabel, "Not required right now");
  assert.equal(state.steps.bank.statusLabel, "Not required right now");
  assert.equal(state.completion.requiredTotal, 1);
  assert.equal(state.completion.isComplete, false);
});

void test("bank required but not verified is marked as coming soon", () => {
  const state = buildVerificationCenterState({
    status: {
      email: { verified: true },
      phone: { verified: true },
      bank: { verified: false },
    },
    requirements: {
      requireEmail: true,
      requirePhone: true,
      requireBank: true,
    },
  });

  assert.equal(state.steps.bank.statusLabel, "Coming soon");
  assert.equal(state.completion.isComplete, false);
});

void test("isVerificationCompleteForRequirements only checks enabled requirements", () => {
  const completed = isVerificationCompleteForRequirements(
    {
      email: { verified: true },
      phone: { verified: false },
      bank: { verified: false },
    },
    {
      requireEmail: true,
      requirePhone: false,
      requireBank: false,
    }
  );
  assert.equal(completed, true);
});
