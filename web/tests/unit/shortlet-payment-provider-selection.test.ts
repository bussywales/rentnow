import test from "node:test";
import assert from "node:assert/strict";
import { resolveShortletPaymentProviderDecision } from "@/lib/shortlet/payments.server";

void test("provider decision prefers paystack for NG shortlets and NGN currency", () => {
  const decision = resolveShortletPaymentProviderDecision({
    propertyCountry: "NG",
    bookingCurrency: "NGN",
    stripeEnabled: true,
    paystackEnabled: true,
  });

  assert.equal(decision.chosenProvider, "paystack");
  assert.equal(decision.wantsPaystack, true);
});

void test("provider decision falls back to stripe when paystack is disabled for non-NGN", () => {
  const decision = resolveShortletPaymentProviderDecision({
    propertyCountry: "NG",
    bookingCurrency: "USD",
    stripeEnabled: true,
    paystackEnabled: false,
  });

  assert.equal(decision.chosenProvider, "stripe");
});

void test("provider decision forces paystack for NGN and rejects stripe-only state", () => {
  const decision = resolveShortletPaymentProviderDecision({
    propertyCountry: "US",
    bookingCurrency: "NGN",
    stripeEnabled: true,
    paystackEnabled: false,
  });

  assert.equal(decision.chosenProvider, null);
});

void test("provider decision falls back to paystack when stripe is disabled", () => {
  const decision = resolveShortletPaymentProviderDecision({
    propertyCountry: "US",
    bookingCurrency: "USD",
    stripeEnabled: false,
    paystackEnabled: true,
  });

  assert.equal(decision.chosenProvider, "paystack");
});
