import test from "node:test";
import assert from "node:assert/strict";
import {
  parseReferralSettingsRows,
  resolveReferralTierStatus,
} from "@/lib/referrals/settings";

void test("parseReferralSettingsRows reads referral enabled flag from app settings", () => {
  const enabled = parseReferralSettingsRows([
    { key: "referrals_enabled", value: { enabled: true } },
  ]);
  assert.equal(enabled.enabled, true);

  const disabled = parseReferralSettingsRows([
    { key: "referrals_enabled", value: { enabled: false } },
  ]);
  assert.equal(disabled.enabled, false);
});

void test("parseReferralSettingsRows keeps bronze tier baseline when only upper tiers are configured", () => {
  const settings = parseReferralSettingsRows([
    {
      key: "referrals_tier_thresholds",
      value: { value: { silver: 5, gold: 15, platinum: 30 } },
    },
  ]);

  assert.equal(settings.tierThresholds.Bronze, 0);
  assert.equal(settings.tierThresholds.Silver, 5);
  assert.equal(settings.tierThresholds.Gold, 15);
  assert.equal(settings.tierThresholds.Platinum, 30);
});

void test("resolveReferralTierStatus computes tiers from active referral thresholds", () => {
  const thresholds = {
    Bronze: 0,
    Silver: 5,
    Gold: 15,
    Platinum: 30,
  };

  const silver = resolveReferralTierStatus(6, thresholds);
  assert.equal(silver.currentTier, "Silver");
  assert.equal(silver.nextTier, "Gold");
  assert.equal(silver.nextThreshold, 15);

  const gold = resolveReferralTierStatus(16, thresholds);
  assert.equal(gold.currentTier, "Gold");
  assert.equal(gold.nextTier, "Platinum");

  const platinum = resolveReferralTierStatus(35, thresholds);
  assert.equal(platinum.currentTier, "Platinum");
  assert.equal(platinum.nextTier, null);
  assert.equal(platinum.progressToNext, 100);
});

void test("parseReferralSettingsRows parses share-tracking controls", () => {
  const settings = parseReferralSettingsRows([
    { key: "enable_share_tracking", value: { enabled: false } },
    { key: "attribution_window_days", value: { days: 45 } },
    { key: "store_ip_hash", value: { enabled: true } },
  ]);

  assert.equal(settings.shareTracking.enabled, false);
  assert.equal(settings.shareTracking.attributionWindowDays, 45);
  assert.equal(settings.shareTracking.storeIpHash, true);
});
