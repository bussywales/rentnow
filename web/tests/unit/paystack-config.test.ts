import test from "node:test";
import assert from "node:assert/strict";

import { resolvePaystackConfig } from "../../lib/billing/paystack";

void test("paystack config uses live keys when present", () => {
  const config = resolvePaystackConfig({
    mode: "live",
    settings: {
      paystack_live_secret_key: "ps_live_secret",
      paystack_live_public_key: "pk_live_public",
    },
  });

  assert.equal(config.mode, "live");
  assert.equal(config.secretKey, "ps_live_secret");
  assert.equal(config.publicKey, "pk_live_public");
  assert.equal(config.fallbackFromLive, false);
});

void test("paystack config falls back to test when live keys are missing", () => {
  const config = resolvePaystackConfig({
    mode: "live",
    settings: {
      paystack_test_secret_key: "ps_test_secret",
      paystack_test_public_key: "pk_test_public",
    },
  });

  assert.equal(config.mode, "test");
  assert.equal(config.secretKey, "ps_test_secret");
  assert.equal(config.publicKey, "pk_test_public");
  assert.equal(config.fallbackFromLive, true);
});
