import test from "node:test";
import assert from "node:assert/strict";

import { getStripeConfigForMode } from "../../lib/billing/stripe";

const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_SECRET_KEY_TEST",
  "STRIPE_SECRET_KEY_LIVE",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_WEBHOOK_SECRET_TEST",
  "STRIPE_WEBHOOK_SECRET_LIVE",
];

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

function resetEnv() {
  ENV_KEYS.forEach((key) => {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
}

void test("stripe config prefers mode-specific keys", () => {
  process.env.STRIPE_SECRET_KEY = "sk_single";
  process.env.STRIPE_WEBHOOK_SECRET = "wh_single";
  process.env.STRIPE_SECRET_KEY_TEST = "sk_test_mode";
  process.env.STRIPE_WEBHOOK_SECRET_TEST = "wh_test_mode";
  process.env.STRIPE_SECRET_KEY_LIVE = "sk_live_mode";
  process.env.STRIPE_WEBHOOK_SECRET_LIVE = "wh_live_mode";

  const testConfig = getStripeConfigForMode("test");
  assert.equal(testConfig.secretKey, "sk_test_mode");
  assert.equal(testConfig.webhookSecret, "wh_test_mode");

  const liveConfig = getStripeConfigForMode("live");
  assert.equal(liveConfig.secretKey, "sk_live_mode");
  assert.equal(liveConfig.webhookSecret, "wh_live_mode");

  resetEnv();
});

void test("stripe config falls back to single keys", () => {
  process.env.STRIPE_SECRET_KEY = "sk_single_only";
  process.env.STRIPE_WEBHOOK_SECRET = "wh_single_only";
  delete process.env.STRIPE_SECRET_KEY_TEST;
  delete process.env.STRIPE_WEBHOOK_SECRET_TEST;
  delete process.env.STRIPE_SECRET_KEY_LIVE;
  delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;

  const config = getStripeConfigForMode("live");
  assert.equal(config.secretKey, "sk_single_only");
  assert.equal(config.webhookSecret, "wh_single_only");

  resetEnv();
});
