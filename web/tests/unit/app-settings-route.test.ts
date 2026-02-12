import test from "node:test";
import assert from "node:assert/strict";
import {
  patchSchema,
  validatePatchPayload,
  validateSettingValueByKey,
} from "@/app/api/admin/app-settings/route";

void test("patchSchema rejects non-boolean enabled", () => {
  assert.throws(() =>
    patchSchema.parse({ key: "show_tenant_photo_trust_signals", value: { enabled: "yes" } })
  );
});

void test("patchSchema accepts correct payload", () => {
  const parsed = patchSchema.parse({
    key: "show_tenant_photo_trust_signals",
    value: { enabled: false },
  });
  assert.equal(parsed.value.enabled, false);
});

void test("patchSchema accepts location picker payload", () => {
  const parsed = patchSchema.parse({
    key: "enable_location_picker",
    value: { enabled: true },
  });
  assert.equal(parsed.key, "enable_location_picker");
});

void test("patchSchema accepts check-in badge payload", () => {
  const parsed = patchSchema.parse({
    key: "show_tenant_checkin_badge",
    value: { enabled: true },
  });
  assert.equal(parsed.key, "show_tenant_checkin_badge");
});

void test("patchSchema accepts require location pin payload", () => {
  const parsed = patchSchema.parse({
    key: "require_location_pin_for_publish",
    value: { enabled: true },
  });
  assert.equal(parsed.key, "require_location_pin_for_publish");
});

void test("patchSchema accepts agent storefront payload", () => {
  const parsed = patchSchema.parse({
    key: "agent_storefronts_enabled",
    value: { enabled: true },
  });
  assert.equal(parsed.key, "agent_storefronts_enabled");
});

void test("patchSchema accepts agent network discovery payload", () => {
  const parsed = patchSchema.parse({
    key: "agent_network_discovery_enabled",
    value: { enabled: true },
  });
  assert.equal(parsed.key, "agent_network_discovery_enabled");
});

void test("patchSchema accepts payg amount payload", () => {
  const parsed = patchSchema.parse({
    key: "payg_listing_fee_amount",
    value: { value: 2000 },
  });
  assert.equal(parsed.key, "payg_listing_fee_amount");
});

void test("patchSchema accepts trial credits payload", () => {
  const parsed = patchSchema.parse({
    key: "trial_listing_credits_agent",
    value: { value: 3 },
  });
  assert.equal(parsed.key, "trial_listing_credits_agent");
});

void test("patchSchema accepts referral max depth payload", () => {
  const parsed = patchSchema.parse({
    key: "referral_max_depth",
    value: { value: 3 },
  });
  assert.equal(parsed.key, "referral_max_depth");
});

void test("patchSchema accepts referral enabled levels payload", () => {
  const parsed = patchSchema.parse({
    key: "referral_enabled_levels",
    value: { value: [1, 2, 3] },
  });
  assert.equal(parsed.key, "referral_enabled_levels");
});

void test("patchSchema accepts referral reward rules payload", () => {
  const parsed = patchSchema.parse({
    key: "referral_reward_rules",
    value: {
      value: {
        "1": { type: "listing_credit", amount: 1 },
        "2": { type: "discount", amount: 10 },
      },
    },
  });
  assert.equal(parsed.key, "referral_reward_rules");
});

void test("patchSchema accepts referral caps payload", () => {
  const parsed = patchSchema.parse({
    key: "referral_caps",
    value: { value: { daily: 50, monthly: 500 } },
  });
  assert.equal(parsed.key, "referral_caps");
});

void test("validatePatchPayload rejects invalid keys", () => {
  const parsed = validatePatchPayload({ key: "not_a_key", value: { enabled: true } });
  assert.equal(parsed.ok, false);
});

void test("validateSettingValueByKey rejects referral max depth outside 1-5", () => {
  assert.equal(validateSettingValueByKey("referral_max_depth", { value: 9 }), false);
});

void test("validateSettingValueByKey rejects invalid referral levels payload", () => {
  assert.equal(
    validateSettingValueByKey("referral_enabled_levels", { value: [1, 7] }),
    false
  );
});

void test("validateSettingValueByKey rejects invalid referral caps payload", () => {
  assert.equal(
    validateSettingValueByKey("referral_caps", { value: { daily: 200, monthly: 100 } }),
    false
  );
});

void test("validateSettingValueByKey accepts leaderboard toggle payloads", () => {
  assert.equal(
    validateSettingValueByKey("referrals_leaderboard_enabled", { enabled: true }),
    true
  );
  assert.equal(
    validateSettingValueByKey("referrals_leaderboard_public_visible", { enabled: false }),
    true
  );
  assert.equal(
    validateSettingValueByKey("referrals_leaderboard_monthly_enabled", { enabled: true }),
    true
  );
  assert.equal(
    validateSettingValueByKey("referrals_leaderboard_all_time_enabled", { enabled: true }),
    true
  );
  assert.equal(
    validateSettingValueByKey("referrals_leaderboard_initials_only", { enabled: true }),
    true
  );
  assert.equal(
    validateSettingValueByKey("referrals_leaderboard_scope", { scope: "global" }),
    true
  );
  assert.equal(
    validateSettingValueByKey("referrals_leaderboard_scope", { scope: "invalid_scope" }),
    false
  );
});

void test("validateSettingValueByKey accepts share tracking payloads", () => {
  assert.equal(validateSettingValueByKey("enable_share_tracking", { enabled: true }), true);
  assert.equal(validateSettingValueByKey("store_ip_hash", { enabled: false }), true);
  assert.equal(validateSettingValueByKey("attribution_window_days", { days: 30 }), true);
  assert.equal(validateSettingValueByKey("attribution_window_days", { days: 0 }), false);
});

void test("validateSettingValueByKey accepts demo presentation toggles", () => {
  assert.equal(validateSettingValueByKey("demo_badge_enabled", { enabled: true }), true);
  assert.equal(validateSettingValueByKey("demo_watermark_enabled", { enabled: false }), true);
});

void test("validateSettingValueByKey accepts saved-search email alerts toggle", () => {
  assert.equal(validateSettingValueByKey("alerts_email_enabled", { enabled: true }), true);
});

void test("validateSettingValueByKey accepts alerts kill switch and last-run status payload", () => {
  assert.equal(
    validateSettingValueByKey("alerts_kill_switch_enabled", { enabled: true }),
    true
  );
  assert.equal(
    validateSettingValueByKey("alerts_last_run_status_json", {
      ran_at_utc: "2026-02-12T18:00:00.000Z",
      mode: "admin",
      users_processed: 2,
      digests_sent: 1,
      searches_included: 3,
      failed_users: 0,
      disabled_reason: null,
    }),
    true
  );
});

void test("validateSettingValueByKey accepts featured request pricing and rules payloads", () => {
  assert.equal(validateSettingValueByKey("featured_requests_enabled", { enabled: true }), true);
  assert.equal(validateSettingValueByKey("featured_price_7d_minor", { value: 1999 }), true);
  assert.equal(validateSettingValueByKey("featured_price_30d_minor", { value: 4999 }), true);
  assert.equal(validateSettingValueByKey("featured_currency", { value: "GBP" }), true);
  assert.equal(validateSettingValueByKey("featured_review_sla_days", { value: 2 }), true);
  assert.equal(validateSettingValueByKey("featured_requires_approved_listing", { enabled: true }), true);
  assert.equal(validateSettingValueByKey("featured_requires_active_listing", { enabled: true }), true);
  assert.equal(validateSettingValueByKey("featured_requires_not_demo", { enabled: true }), true);
  assert.equal(validateSettingValueByKey("featured_min_photos", { value: 3 }), true);
  assert.equal(validateSettingValueByKey("featured_min_description_chars", { value: 80 }), true);
});

void test("validateSettingValueByKey rejects invalid featured request payloads", () => {
  assert.equal(validateSettingValueByKey("featured_currency", { value: "GB" }), false);
  assert.equal(validateSettingValueByKey("featured_review_sla_days", { value: 0 }), false);
  assert.equal(validateSettingValueByKey("featured_min_photos", { value: 25 }), false);
  assert.equal(validateSettingValueByKey("featured_min_description_chars", { value: -1 }), false);
});

void test("validateSettingValueByKey accepts market defaults and toggles", () => {
  assert.equal(validateSettingValueByKey("default_market_country", { value: "NG" }), true);
  assert.equal(validateSettingValueByKey("default_market_currency", { value: "NGN" }), true);
  assert.equal(validateSettingValueByKey("market_auto_detect_enabled", { enabled: true }), true);
  assert.equal(validateSettingValueByKey("market_selector_enabled", { enabled: false }), true);
});

void test("validateSettingValueByKey rejects invalid market defaults", () => {
  assert.equal(validateSettingValueByKey("default_market_country", { value: "NIG" }), false);
  assert.equal(validateSettingValueByKey("default_market_currency", { value: "NG" }), false);
});
