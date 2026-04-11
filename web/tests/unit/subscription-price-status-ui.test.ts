import test from "node:test";
import assert from "node:assert/strict";

import {
  getSubscriptionControlStatusTone,
  getSubscriptionDiagnosticTone,
} from "@/lib/billing/subscription-price-status-ui";

void test("pricing control status tones keep healthy informational warning and blocking states distinct", () => {
  assert.match(getSubscriptionControlStatusTone("active").className, /emerald/i);
  assert.equal(getSubscriptionControlStatusTone("active").categoryLabel, "Good");

  assert.match(getSubscriptionControlStatusTone("pending_publish").className, /sky/i);
  assert.equal(getSubscriptionControlStatusTone("pending_publish").categoryLabel, "Info");

  assert.match(getSubscriptionControlStatusTone("missing_stripe_ref").className, /amber/i);
  assert.equal(getSubscriptionControlStatusTone("missing_stripe_ref").categoryLabel, "Warning");

  assert.match(getSubscriptionControlStatusTone("misaligned").className, /rose/i);
  assert.equal(getSubscriptionControlStatusTone("misaligned").categoryLabel, "Blocking");
});

void test("pricing diagnostic tones no longer treat informational states like warnings", () => {
  assert.match(getSubscriptionDiagnosticTone("Aligned").className, /emerald/i);
  assert.equal(getSubscriptionDiagnosticTone("Aligned").categoryLabel, "Good");

  assert.match(getSubscriptionDiagnosticTone("Canonical runtime").className, /sky/i);
  assert.equal(getSubscriptionDiagnosticTone("Canonical runtime").categoryLabel, "Info");

  assert.match(getSubscriptionDiagnosticTone("Superseded row history").className, /sky/i);
  assert.equal(getSubscriptionDiagnosticTone("Superseded row history").categoryLabel, "Info");

  assert.match(getSubscriptionDiagnosticTone("Cross-currency canonical").className, /amber/i);
  assert.equal(getSubscriptionDiagnosticTone("Cross-currency canonical").categoryLabel, "Warning");

  assert.match(getSubscriptionDiagnosticTone("Checkout mismatch").className, /rose/i);
  assert.equal(getSubscriptionDiagnosticTone("Checkout mismatch").categoryLabel, "Blocking");
});
