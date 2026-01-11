import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReliabilityItems,
  buildTrustBadges,
} from "../../lib/trust-markers";

void test("buildTrustBadges returns empty when markers missing", () => {
  assert.deepEqual(buildTrustBadges(null), []);
  assert.deepEqual(buildTrustBadges(undefined), []);
});

void test("buildTrustBadges reports verified and unverified states", () => {
  const badges = buildTrustBadges({
    email_verified: true,
    phone_verified: false,
    bank_verified: true,
  });
  assert.equal(badges.length, 3);
  assert.equal(badges[0].label, "Email verified");
  assert.equal(badges[1].label, "Phone not verified");
  assert.equal(badges[2].label, "Bank verified");
});

void test("buildReliabilityItems ignores unknown values", () => {
  const items = buildReliabilityItems({
    reliability_power: "good",
    reliability_water: "unknown",
    reliability_internet: "fair",
  });
  assert.deepEqual(
    items.map((item) => `${item.label}:${item.value}`),
    ["Power:Good", "Internet:Fair"]
  );
});
