import test from "node:test";
import assert from "node:assert/strict";
import { parseReferralSettingsRows } from "@/lib/referrals/settings";

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
