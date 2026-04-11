import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveSubscriptionPriceControlStatus,
  normalizeSubscriptionPriceWorkflowState,
} from "@/lib/billing/subscription-price-book";

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
