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

void test("provider decision allows stripe fallback for NGN when paystack is disabled", () => {
  const decision = resolveShortletPaymentProviderDecision({
    propertyCountry: "US",
    bookingCurrency: "NGN",
    stripeEnabled: true,
    paystackEnabled: false,
  });

  assert.equal(decision.chosenProvider, "stripe");
  assert.equal(decision.reason, null);
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

void test("provider decision treats lowercase ngn and naira symbol as NGN", () => {
  const lowercaseCurrency = resolveShortletPaymentProviderDecision({
    propertyCountry: "US",
    bookingCurrency: "ngn",
    stripeEnabled: true,
    paystackEnabled: true,
  });
  const symbolCurrency = resolveShortletPaymentProviderDecision({
    propertyCountry: "US",
    bookingCurrency: "₦",
    stripeEnabled: true,
    paystackEnabled: true,
  });

  assert.equal(lowercaseCurrency.bookingCurrency, "NGN");
  assert.equal(lowercaseCurrency.chosenProvider, "paystack");
  assert.equal(symbolCurrency.bookingCurrency, "NGN");
  assert.equal(symbolCurrency.chosenProvider, "paystack");
});

void test("provider decision defaults missing currency to NGN for NG listings", () => {
  const decision = resolveShortletPaymentProviderDecision({
    propertyCountry: "NG",
    bookingCurrency: "",
    stripeEnabled: true,
    paystackEnabled: true,
  });

  assert.equal(decision.bookingCurrency, "NGN");
  assert.equal(decision.chosenProvider, "paystack");
});

void test("provider decision fails with reason for unsupported currency", () => {
  const decision = resolveShortletPaymentProviderDecision({
    propertyCountry: "US",
    bookingCurrency: "usd$",
    stripeEnabled: true,
    paystackEnabled: true,
  });

  assert.equal(decision.chosenProvider, null);
  assert.equal(decision.reason, "unsupported_currency:USD$");
});
