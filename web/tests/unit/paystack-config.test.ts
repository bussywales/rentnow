import test from "node:test";
import assert from "node:assert/strict";

import { resolvePaystackConfig, resolvePaystackServerConfig } from "../../lib/billing/paystack";

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

void test("paystack server config uses stored provider keys before env fallback", () => {
  const config = resolvePaystackServerConfig({
    mode: "live",
    settings: {
      paystack_live_secret_key: "ps_live_secret",
      paystack_live_public_key: "pk_live_public",
    },
    env: {
      PAYSTACK_SECRET_KEY_LIVE: "env_live_secret",
      PAYSTACK_PUBLIC_KEY_LIVE: "env_live_public",
    } as NodeJS.ProcessEnv,
  });

  assert.equal(config.mode, "live");
  assert.equal(config.secretKey, "ps_live_secret");
  assert.equal(config.publicKey, "pk_live_public");
  assert.equal(config.source, "db");
  assert.equal(config.webhookSecret, "ps_live_secret");
  assert.equal(config.webhookSource, "resolved_secret_key");
});

void test("paystack server config uses scoped webhook env before resolved secret", () => {
  const config = resolvePaystackServerConfig({
    mode: "live",
    settings: {
      paystack_live_secret_key: "ps_live_secret",
    },
    env: {
      PAYSTACK_WEBHOOK_SECRET_LIVE: "wh_live_secret",
      PAYSTACK_WEBHOOK_SECRET: "wh_generic_secret",
    } as NodeJS.ProcessEnv,
  });

  assert.equal(config.mode, "live");
  assert.equal(config.webhookSecret, "wh_live_secret");
  assert.equal(config.webhookSource, "env");
});

void test("paystack server config falls back to env keys when stored keys are absent", () => {
  const config = resolvePaystackServerConfig({
    mode: "test",
    env: {
      PAYSTACK_SECRET_KEY_TEST: "env_test_secret",
      PAYSTACK_PUBLIC_KEY_TEST: "env_test_public",
      PAYSTACK_WEBHOOK_SECRET_TEST: "wh_test_secret",
    } as NodeJS.ProcessEnv,
  });

  assert.equal(config.mode, "test");
  assert.equal(config.secretKey, "env_test_secret");
  assert.equal(config.publicKey, "env_test_public");
  assert.equal(config.source, "env");
  assert.equal(config.webhookSecret, "wh_test_secret");
  assert.equal(config.webhookSource, "env");
});
