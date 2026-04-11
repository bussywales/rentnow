import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveSubscriptionPriceControlStatus,
  normalizeSubscriptionPriceWorkflowState,
} from "@/lib/billing/subscription-price-book";
import { shouldInvalidateStripeDraftBinding } from "@/lib/billing/subscription-price-control-plane.server";

void test("workflow state defaults active rows and archives historical rows", () => {
  assert.equal(
    normalizeSubscriptionPriceWorkflowState({ workflow_state: null, active: true, ends_at: null }),
    "active"
  );
  assert.equal(
    normalizeSubscriptionPriceWorkflowState({ workflow_state: null, active: false, ends_at: "2026-04-11T00:00:00Z" }),
    "archived"
  );
});

void test("draft status becomes publish-ready only when validation is clean", () => {
  assert.equal(
    deriveSubscriptionPriceControlStatus({
      workflowState: "draft",
      marketGap: false,
      missingProviderRef: false,
      checkoutMatchesCanonical: false,
      runtimeUnavailable: false,
      diagnostics: [],
    }),
    "pending_publish"
  );
  assert.equal(
    deriveSubscriptionPriceControlStatus({
      workflowState: "draft",
      marketGap: false,
      missingProviderRef: true,
      checkoutMatchesCanonical: false,
      runtimeUnavailable: false,
      diagnostics: [],
    }),
    "missing_stripe_ref"
  );
  assert.equal(
    deriveSubscriptionPriceControlStatus({
      workflowState: "draft",
      marketGap: false,
      missingProviderRef: false,
      checkoutMatchesCanonical: false,
      runtimeUnavailable: false,
      diagnostics: ["Checkout mismatch"],
    }),
    "misaligned"
  );
});

void test("active row status distinguishes aligned, missing-ref, and blocked states", () => {
  assert.equal(
    deriveSubscriptionPriceControlStatus({
      workflowState: "active",
      marketGap: false,
      missingProviderRef: false,
      checkoutMatchesCanonical: true,
      runtimeUnavailable: false,
      diagnostics: [],
    }),
    "active"
  );
  assert.equal(
    deriveSubscriptionPriceControlStatus({
      workflowState: "active",
      marketGap: false,
      missingProviderRef: true,
      checkoutMatchesCanonical: false,
      runtimeUnavailable: false,
      diagnostics: [],
    }),
    "missing_stripe_ref"
  );
  assert.equal(
    deriveSubscriptionPriceControlStatus({
      workflowState: "active",
      marketGap: false,
      missingProviderRef: false,
      checkoutMatchesCanonical: false,
      runtimeUnavailable: true,
      diagnostics: ["Runtime unavailable"],
    }),
    "blocked"
  );
});

void test("draft binding is invalidated when amount changes and the old Stripe ref is still attached", () => {
  assert.equal(
    shouldInvalidateStripeDraftBinding(
      {
        market_country: "CA",
        role: "landlord",
        cadence: "monthly",
        currency: "CAD",
        amount_minor: 1999,
        provider_price_ref: "price_123",
      },
      {
        marketCountry: "CA",
        role: "landlord",
        cadence: "monthly",
        currency: "CAD",
        amountMinor: 2499,
        providerPriceRef: "price_123",
      }
    ),
    true
  );
});

void test("draft binding stays intact when the billing terms are unchanged", () => {
  assert.equal(
    shouldInvalidateStripeDraftBinding(
      {
        market_country: "US",
        role: "tenant",
        cadence: "yearly",
        currency: "USD",
        amount_minor: 9900,
        provider_price_ref: "price_abc",
      },
      {
        marketCountry: "US",
        role: "tenant",
        cadence: "yearly",
        currency: "USD",
        amountMinor: 9900,
        providerPriceRef: "price_abc",
      }
    ),
    false
  );
});

void test("draft binding can be replaced manually with a new Stripe ref after a pricing change", () => {
  assert.equal(
    shouldInvalidateStripeDraftBinding(
      {
        market_country: "GB",
        role: "agent",
        cadence: "monthly",
        currency: "GBP",
        amount_minor: 4999,
        provider_price_ref: "price_old",
      },
      {
        marketCountry: "GB",
        role: "agent",
        cadence: "monthly",
        currency: "GBP",
        amountMinor: 5999,
        providerPriceRef: "price_new",
      }
    ),
    false
  );
});
