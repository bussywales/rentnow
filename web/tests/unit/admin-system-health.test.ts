import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSystemHealthSettingsSnapshot,
  getSystemHealthEnvStatus,
} from "@/lib/admin/system-health";

void test("getSystemHealthEnvStatus exposes presence flags without secret values", () => {
  const status = getSystemHealthEnvStatus({
    RESEND_API_KEY: "re_123",
    CRON_SECRET: "",
    PAYSTACK_SECRET_KEY: "sk_live_x",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "abcdef1234567890",
  });

  assert.equal(status.resendApiKeyPresent, true);
  assert.equal(status.cronSecretPresent, false);
  assert.equal(status.paystackSecretKeyPresent, true);
  assert.equal(status.commitSha, "abcdef1234567890");
});

void test("buildSystemHealthSettingsSnapshot parses booleans and market defaults", () => {
  const snapshot = buildSystemHealthSettingsSnapshot([
    { key: "alerts_email_enabled", value: { enabled: true } },
    { key: "alerts_kill_switch_enabled", value: { enabled: false } },
    { key: "featured_requests_enabled", value: { enabled: false } },
    { key: "featured_listings_enabled", value: { enabled: true } },
    { key: "verification_require_email", value: { enabled: true } },
    { key: "verification_require_phone", value: { enabled: false } },
    { key: "verification_require_bank", value: { enabled: false } },
    { key: "default_market_country", value: { value: "ng" } },
    { key: "default_market_currency", value: { value: "ngn" } },
    { key: "market_auto_detect_enabled", value: { enabled: true } },
    { key: "market_selector_enabled", value: { enabled: true } },
  ]);

  assert.equal(snapshot.alertsEmailEnabled, true);
  assert.equal(snapshot.alertsKillSwitchEnabled, false);
  assert.equal(snapshot.featuredRequestsEnabled, false);
  assert.equal(snapshot.featuredListingsEnabled, true);
  assert.equal(snapshot.verificationRequireEmail, true);
  assert.equal(snapshot.verificationRequirePhone, false);
  assert.equal(snapshot.verificationRequireBank, false);
  assert.equal(snapshot.defaultMarketCountry, "NG");
  assert.equal(snapshot.defaultMarketCurrency, "NGN");
  assert.equal(snapshot.marketAutoDetectEnabled, true);
  assert.equal(snapshot.marketSelectorEnabled, true);
});
