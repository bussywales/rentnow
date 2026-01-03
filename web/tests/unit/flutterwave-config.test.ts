import test from "node:test";
import assert from "node:assert/strict";

import { resolveFlutterwaveConfig } from "../../lib/billing/flutterwave";

void test("flutterwave config uses live keys when present", () => {
  const config = resolveFlutterwaveConfig({
    mode: "live",
    settings: {
      flutterwave_live_secret_key: "flw_live_secret",
      flutterwave_live_public_key: "flw_live_public",
    },
  });

  assert.equal(config.mode, "live");
  assert.equal(config.secretKey, "flw_live_secret");
  assert.equal(config.publicKey, "flw_live_public");
  assert.equal(config.fallbackFromLive, false);
});

void test("flutterwave config falls back to test when live keys are missing", () => {
  const config = resolveFlutterwaveConfig({
    mode: "live",
    settings: {
      flutterwave_test_secret_key: "flw_test_secret",
      flutterwave_test_public_key: "flw_test_public",
    },
  });

  assert.equal(config.mode, "test");
  assert.equal(config.secretKey, "flw_test_secret");
  assert.equal(config.publicKey, "flw_test_public");
  assert.equal(config.fallbackFromLive, true);
});
